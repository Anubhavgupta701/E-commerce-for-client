import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { col, findById, getSettings, UPLOAD_DIR } from '../db.js';
import { requireAuth, requireRole, audit } from '../auth.js';
import { uid, nowIso, formatINR, hmacSign, hmacVerify } from '../util.js';

export const PUBLIC_IMG_DIR = path.join(UPLOAD_DIR, 'public');

const router = Router();
const FILE_SECRET = process.env.FILE_SECRET || 'khaas-dev-file-secret-change-in-prod';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uid('file_') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PNG, JPG, WebP or PDF screenshots are allowed.'), ok);
  },
});

// Multer for public product images (admin-only upload, publicly served)
fs.mkdirSync(PUBLIC_IMG_DIR, { recursive: true });
const productImgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PUBLIC_IMG_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, uid('img_') + ext);
  },
});
const productUpload = multer({
  storage: productImgStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PNG, JPG, WebP or GIF images are allowed.'), ok);
  },
});
const adminOnly = requireRole('ADMIN', 'SUPERADMIN');

function canSeeOrder(req, order) {
  return order.userId === req.auth.user.id || req.auth.roles.includes('SUPERADMIN');
}

/** Build a short-lived signed URL for a private file. */
export function fileViewUrl(fileId, minutes = 15) {
  const exp = Date.now() + minutes * 60000;
  const sig = hmacSign(`${fileId}:${exp}`, FILE_SECRET);
  return `/api/files/${fileId}/view?exp=${exp}&sig=${sig}`;
}

function checkFileSig(req, res, next) {
  const { exp, sig } = req.query;
  if (!exp || !sig || Date.now() > Number(exp) || !hmacVerify(`${req.params.fileId}:${exp}`, sig, FILE_SECRET)) {
    return res.status(403).json({ error: 'This link has expired. Please request a fresh one.' });
  }
  next();
}

// Upload a payment screenshot (private storage)
router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    const rec = {
      id: uid('file_'), storedName: req.file.filename, originalName: req.file.originalname,
      mime: req.file.mimetype, size: req.file.size, uploadedBy: req.auth.user.id, createdAt: nowIso(),
    };
    col('files').push(rec);
    res.status(201).json({ fileId: rec.id, viewUrl: fileViewUrl(rec.id) });
  });
});

// Upload product images (admin only, publicly accessible, up to 10 at once)
router.post('/product-images', adminOnly, (req, res) => {
  productUpload.array('images', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images received.' });
    const urls = req.files.map((f) => `/api/files/img/${f.filename}`);
    audit(req.auth.user.id, 'product.image_upload', 'file', null, { count: req.files.length });
    res.status(201).json({ urls });
  });
});

// Serve public product images (no auth required)
router.get('/img/:filename', (req, res) => {
  const safe = path.basename(req.params.filename);
  const abs = path.join(PUBLIC_IMG_DIR, safe);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Image not found.' });
  res.sendFile(abs);
});

// Stream a private file via signed URL
router.get('/:fileId/view', requireAuth, checkFileSig, (req, res) => {
  const f = findById('files', req.params.fileId);
  if (!f) return res.status(404).json({ error: 'File not found.' });
  const isStaff = req.auth.roles.includes('SUPERADMIN');
  if (f.uploadedBy !== req.auth.user.id && !isStaff) return res.status(403).json({ error: 'Not allowed.' });
  const abs = path.join(UPLOAD_DIR, f.storedName);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'File missing from storage.' });
  res.setHeader('Content-Type', f.mime);
  res.setHeader('Content-Disposition', `inline; filename="${f.originalName.replace(/"/g, '')}"`);
  fs.createReadStream(abs).pipe(res);
});

export default router;
