import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { Field, Chip, Empty } from '../components/ui.jsx';

export default function PaymentPage() {
  const { orderNumber } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = () => api.get(`/api/orders/${orderNumber}/payment-info`).then(setInfo).catch(() => setInfo({ missing: true }));
  useEffect(() => { load(); }, [orderNumber]);

  if (info === null) return <p>Loading…</p>;
  if (info.missing) return <Empty icon="🧾" title="Order not found" text="Check the order number." />;

  const submit = async () => {
    setBusy(true); setErr(''); setOk('');
    try {
      let fileId = null;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const up = await api.upload('/api/files/upload', form);
        fileId = up.fileId;
      }
      const key = 'pay_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await api.post(`/api/orders/${orderNumber}/payment-submissions`, { utr, fileId, idempotencyKey: key });
      setOk('Payment details submitted! Our team will verify it shortly — you can track status on your order page.');
      setUtr(''); setFile(null);
      load();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const latest = info.submissions?.[0];

  return (
    <>
      <h1>Complete your payment</h1>
      <p className="lead">Order <strong>{info.orderNumber}</strong> · Amount due <strong>{info.amountDisplay}</strong> · <Chip status={info.paymentStatus} /></p>

      {['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(info.paymentStatus) && latest && (
        <div className="alert alert-info">
          {info.paymentStatus === 'PENDING' && !latest ? '' : `Latest submission is ${info.paymentStatus.toLowerCase().replace('_', ' ')}. Your order ships once our team verifies the payment.`}
        </div>
      )}
      {info.paymentStatus === 'REJECTED' && latest?.rejectionReason && (
        <div className="alert alert-error"><strong>Payment was not verified.</strong> Reason: {latest.rejectionReason}. Please pay again and resubmit below.</div>
      )}
      {info.paymentStatus === 'APPROVED' && (
        <div className="alert alert-ok">Payment verified ✓ — your order is being prepared. <Link to={`/account/orders/${info.orderNumber}`}>Track order →</Link></div>
      )}

      {err && <div className="alert alert-error">{err}</div>}
      {ok && <div className="alert alert-ok">{ok}</div>}

      {['PENDING', 'REJECTED', 'FAILED'].includes(info.paymentStatus) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }} className="pay-grid">
          <div className="qr-box">
            <h3 style={{ marginTop: 0 }}>Step 1 — Pay via UPI</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>{info.qr.instructions}</p>
            <div className="upi-id">{info.qr.upiId}</div>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>Payee: {info.qr.payeeName} · Amount: <strong style={{ color: 'var(--espresso)' }}>{info.amountDisplay}</strong></p>
          </div>
          <div className="form-card">
            <h3 style={{ marginTop: 0 }}>Step 2 — Submit proof</h3>
            <Field label="UTR / Transaction reference ID" hint="12-digit reference from your UPI app's payment history.">
              <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412345678901" inputMode="numeric" />
            </Field>
            <Field label="Payment screenshot (optional)" hint="PNG, JPG, WebP or PDF, max 5 MB.">
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setFile(e.target.files[0])} />
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy || utr.trim().length < 6} onClick={submit}>
              {busy ? 'Submitting…' : 'Submit for verification'}
            </button>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>Submission is a claim for review — it is not proof of settlement until our team verifies it.</p>
          </div>
        </div>
      )}

      {info.submissions?.length > 0 && (
        <>
          <h3 style={{ marginTop: 36 }}>Submission history</h3>
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Submitted</th><th>UTR</th><th>Amount</th><th>Status</th><th>Review note</th></tr></thead>
            <tbody>
              {info.submissions.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.submittedAt).toLocaleString('en-IN')}</td>
                  <td><code>{s.utr}</code></td>
                  <td>{(s.amountClaimedPaise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                  <td><Chip status={s.status} /></td>
                  <td>{s.rejectionReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      <style>{`@media (max-width:768px){.pay-grid{grid-template-columns:1fr !important}}`}</style>
    </>
  );
}
