// Tiny fetch wrapper — same-origin, cookies included.
async function req(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  if (form) {
    opts.body = form; // multipart — browser sets content-type
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: 'Unexpected server response.' }; }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body }),
  patch: (p, body) => req(p, { method: 'PATCH', body }),
  del: (p) => req(p, { method: 'DELETE' }),
  upload: (p, form) => req(p, { method: 'POST', form }),
};

export function inr(paise) {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function statusLabel(s) {
  return String(s || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
