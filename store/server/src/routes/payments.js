import { Router } from 'express';
import { col, findById, getSettings } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { uid, nowIso, formatINR } from '../util.js';
import { fileViewUrl } from './files.js';

const router = Router();

const VALID_PAYMENT_TRANSITIONS = {
  PENDING: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['SUBMITTED'], // customer may resubmit
  APPROVED: [], // terminal — never silently flip back
  FAILED: ['SUBMITTED'],
  COD_DUE: ['COD_COLLECTED'],
  COD_COLLECTED: [],
};

function serializeSubmission(s) {
  const { ...rest } = s;
  return rest;
}

// ---------- Customer: QR payment info + submission ----------
router.get('/orders/:orderNumber/payment-info', requireAuth, (req, res) => {
  const order = col('orders').find((o) => o.orderNumber === req.params.orderNumber);
  if (!order || order.userId !== req.auth.user.id) return res.status(404).json({ error: 'Order not found.' });
  if (order.paymentMethod !== 'QR') return res.json({ order: { orderNumber: order.orderNumber, paymentMethod: 'COD', paymentStatus: order.paymentStatus } });
  const settings = getSettings();
  const submissions = col('paymentSubmissions')
    .filter((s) => s.orderId === order.id)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .map(serializeSubmission);
  res.json({
    orderNumber: order.orderNumber,
    amountPaise: order.totalPaise,
    amountDisplay: formatINR(order.totalPaise),
    paymentStatus: order.paymentStatus,
    qr: { upiId: settings.qrUpiId, payeeName: settings.qrPayeeName, instructions: settings.qrInstructions },
    submissions,
  });
});

// A submission is a CLAIM for review — never proof of settlement.
router.post('/orders/:orderNumber/payment-submissions', requireAuth, (req, res) => {
  const order = col('orders').find((o) => o.orderNumber === req.params.orderNumber);
  if (!order || order.userId !== req.auth.user.id) return res.status(404).json({ error: 'Order not found.' });
  if (order.paymentMethod !== 'QR') return res.status(400).json({ error: 'This order does not use QR payment.' });
  if (!['PENDING', 'REJECTED', 'FAILED'].includes(order.paymentStatus)) {
    return res.status(400).json({ error: `Payment is already ${order.paymentStatus}. No new submission needed.` });
  }
  const { utr, fileId, idempotencyKey } = req.body || {};
  const cleanUtr = String(utr || '').trim();
  if (cleanUtr.length < 6 || cleanUtr.length > 32) return res.status(400).json({ error: 'Enter the UTR / transaction reference ID from your payment app (6–32 characters).' });

  if (idempotencyKey) {
    const prev = col('idempotencyKeys').find((k) => k.key === idempotencyKey && k.scope === 'payment-submit' && k.userId === req.auth.user.id);
    if (prev) return res.json(prev.response);
  }

  // Duplicate-UTR detection (same merchant context)
  const dupe = col('paymentSubmissions').find((s) => s.utr === cleanUtr && s.orderId !== order.id && !['REJECTED'].includes(s.status));
  if (dupe) return res.status(400).json({ error: 'This UTR has already been submitted for another order. Please check and try again.' });

  if (fileId) {
    const f = findById('files', fileId);
    if (!f || f.uploadedBy !== req.auth.user.id) return res.status(400).json({ error: 'Screenshot upload not found. Please upload again.' });
  }

  const sub = {
    id: uid('pay_'), orderId: order.id, orderNumber: order.orderNumber,
    userId: req.auth.user.id, amountClaimedPaise: order.totalPaise,
    utr: cleanUtr, screenshotFileId: fileId || null,
    status: 'PENDING', submittedAt: nowIso(), createdAt: nowIso(),
    reviewedBy: null, reviewedAt: null, rejectionReason: null,
  };
  col('paymentSubmissions').push(sub);
  order.paymentStatus = 'SUBMITTED';
  order.updatedAt = nowIso();
  order.timeline.push({ at: nowIso(), event: 'Payment submitted for verification', by: req.auth.user.id });
  audit(req.auth.user.id, 'payment.submit', 'paymentSubmission', sub.id, { orderNumber: order.orderNumber });

  const response = { submission: serializeSubmission(sub), paymentStatus: order.paymentStatus };
  if (idempotencyKey) col('idempotencyKeys').push({ key: idempotencyKey, scope: 'payment-submit', userId: req.auth.user.id, response, createdAt: nowIso() });
  res.status(201).json(response);
});

// ---------- Superadmin: review queue ----------
const superOnly = requireRole('SUPERADMIN');

router.get('/superadmin/payment-submissions', superOnly, (req, res) => {
  const { status = '' } = req.query;
  let list = [...col('paymentSubmissions')];
  if (status) list = list.filter((s) => s.status === status);
  list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  res.json({
    items: list.map((s) => ({
      ...serializeSubmission(s),
      amountDisplay: formatINR(s.amountClaimedPaise),
      screenshotUrl: s.screenshotFileId ? fileViewUrl(s.screenshotFileId) : null,
    })),
  });
});

router.post('/superadmin/payment-submissions/:id/approve', superOnly, (req, res) => {
  const sub = findById('paymentSubmissions', req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (!['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(sub.status)) {
    return res.status(409).json({ error: `Already ${sub.status} — concurrent review blocked.` });
  }
  const order = findById('orders', sub.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  sub.status = 'APPROVED';
  sub.reviewedBy = req.auth.user.id;
  sub.reviewedAt = nowIso();
  order.paymentStatus = 'APPROVED';
  order.fulfilmentStatus = order.fulfilmentStatus === 'PLACED' ? 'CONFIRMED' : order.fulfilmentStatus;
  order.updatedAt = nowIso();
  order.timeline.push({ at: nowIso(), event: 'Payment verified and approved', by: req.auth.user.id });
  audit(req.auth.user.id, 'payment.approve', 'paymentSubmission', sub.id, { orderNumber: order.orderNumber });
  res.json({ submission: serializeSubmission(sub) });
});

router.post('/superadmin/payment-submissions/:id/reject', superOnly, (req, res) => {
  const sub = findById('paymentSubmissions', req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  if (!['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(sub.status)) {
    return res.status(409).json({ error: `Already ${sub.status} — concurrent review blocked.` });
  }
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'A rejection reason is required — the customer will see it.' });
  const order = findById('orders', sub.orderId);

  sub.status = 'REJECTED';
  sub.reviewedBy = req.auth.user.id;
  sub.reviewedAt = nowIso();
  sub.rejectionReason = String(reason).trim();
  if (order) {
    order.paymentStatus = 'REJECTED';
    order.updatedAt = nowIso();
    order.timeline.push({ at: nowIso(), event: `Payment rejected: ${sub.rejectionReason}`, by: req.auth.user.id });
  }
  audit(req.auth.user.id, 'payment.reject', 'paymentSubmission', sub.id, { orderNumber: sub.orderNumber, reason: sub.rejectionReason });
  res.json({ submission: serializeSubmission(sub) });
});

export default router;
