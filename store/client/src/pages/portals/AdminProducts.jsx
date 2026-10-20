import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, inr } from '../../api.js';
import { Field, Chip, mediaUrl } from '../../components/ui.jsx';

export function AdminProducts() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const load = () => api.get(`/api/admin/products?q=${encodeURIComponent(q)}`).then((d) => setItems(d.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  return (
    <>
      <h1>Products</h1>
      <div className="toolbar">
        <input type="search" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn btn-secondary btn-sm" onClick={load}>Search</button>
        <Link className="btn btn-primary btn-sm" to="/admin/products/new" style={{ marginLeft: 'auto' }}>+ New product</Link>
      </div>
      {items === null ? <p>Loading…</p> : (
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Product</th><th>Image</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>{items.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.title}</strong><br /><small style={{ color: 'var(--muted)' }}>{p.variants.length} variant{p.variants.length > 1 ? 's' : ''}</small></td>
              <td>
                {p.media && p.media[0]
                  ? <img src={mediaUrl(p.media[0])} alt={p.title} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
                  : <span style={{ color: 'var(--muted)', fontSize: 12 }}>No image</span>}
              </td>
              <td>{p.category?.name}</td>
              <td>{p.priceFromDisplay}</td>
              <td>{p.variants.reduce((n, v) => n + v.stock, 0)}</td>
              <td><Chip status={p.status} /></td>
              <td><Link to={`/admin/products/${p.id}/edit`}>Edit</Link></td>
            </tr>
          ))}
          </tbody>
        </table></div>)}
    </>
  );
}

const blankVariant = () => ({ attributesText: '', price: '', mrp: '', stock: '' });

function ImageUploader({ media, setMedia }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const doUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('images', f));
      const { urls } = await api.upload('/api/files/product-images', fd);
      setMedia((prev) => [...prev, ...urls]);
    } catch (e) {
      setUploadErr(e.message || 'Upload failed.');
    }
    setUploading(false);
  };

  const addUrl = () => {
    const val = urlInput.trim();
    if (!val) return;
    setMedia((prev) => [...prev, val]);
    setUrlInput('');
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files); };
  const remove = (idx) => setMedia((prev) => prev.filter((_, i) => i !== idx));
  const moveLeft = (idx) => { if (idx === 0) return; setMedia((prev) => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; }); };
  const moveRight = (idx) => { setMedia((prev) => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a; }); };

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontWeight: 600, fontSize: 14, display: 'block', marginBottom: 8 }}>
        Product images <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(multiple upload or URL · drag to reorder · first = cover)</small>
      </label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--walnut)' : 'var(--line)'}`,
          borderRadius: 'var(--radius)', padding: '24px 16px', textAlign: 'center',
          cursor: 'pointer', transition: 'border-color .2s, background .2s',
          background: dragOver ? 'rgba(139,105,64,.08)' : 'var(--surface)',
          marginBottom: 10, userSelect: 'none',
        }}
      >
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => doUpload(e.target.files)} />
        {uploading
          ? <span style={{ color: 'var(--muted)' }}>Uploading…</span>
          : <span style={{ color: 'var(--muted)' }}>📁 Drag & drop multiple images here or <strong style={{ color: 'var(--walnut)' }}>click to select files</strong></span>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Or paste image URL (https://… or /img/…)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={addUrl}>+ Add URL</button>
      </div>

      {uploadErr && <p style={{ color: 'crimson', fontSize: 13, marginBottom: 10 }}>{uploadErr}</p>}
      {media.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {media.map((url, idx) => (
            <div key={idx} style={{ position: 'relative', border: idx === 0 ? '2px solid var(--walnut)' : '2px solid var(--line)', borderRadius: 8, overflow: 'hidden', width: 104, flexShrink: 0 }}>
              {idx === 0 && <div style={{ position: 'absolute', top: 4, left: 4, background: 'var(--walnut)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4, letterSpacing: '.06em', textTransform: 'uppercase', lineHeight: 1.4, zIndex: 2 }}>Cover</div>}
              <img src={mediaUrl(url)} alt={`img-${idx}`} style={{ width: 104, height: 104, objectFit: 'cover', display: 'block' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px', background: 'var(--sand)', gap: 2 }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '1px 6px', minWidth: 'unset' }} disabled={idx === 0} onClick={() => moveLeft(idx)}>←</button>
                <button type="button" className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '1px 5px', minWidth: 'unset' }} onClick={() => remove(idx)}>✕</button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '1px 6px', minWidth: 'unset' }} disabled={idx === media.length - 1} onClick={() => moveRight(idx)}>→</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductForm() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', brand: '', categoryId: '', status: 'ACTIVE' });
  const [variants, setVariants] = useState([blankVariant()]);
  const [media, setMedia] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/superadmin/categories').then((d) => setCats(d.categories)).catch(() => api.get('/api/categories').then((d) => setCats(d.categories)).catch(() => {}));
    if (!isNew) {
      api.get('/api/admin/products').then((d) => {
        const p = d.items.find((x) => x.id === id);
        if (!p) { setErr('Product not found.'); return; }
        setForm({ title: p.title, description: p.description, brand: p.brand, categoryId: p.category?.id || '', status: p.status });
        setVariants(p.variants.map((v) => ({
          sku: v.sku,
          attributesText: Object.entries(v.attributes || {}).map(([k, val]) => `${k}=${val}`).join(', '),
          price: String(v.pricePaise / 100), mrp: v.compareAtPaise ? String(v.compareAtPaise / 100) : '', stock: String(v.stock),
        })));
        setMedia(Array.isArray(p.media) ? p.media.map((m) => (typeof m === 'string' ? m : (m?.key ? (m.key.startsWith('/') ? m.key : `/${m.key}`) : ''))).filter(Boolean) : []);
      });
    }
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setV = (i, k) => (e) => { const n = [...variants]; n[i][k] = e.target.value; setVariants(n); };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const payload = {
        ...form,
        media,
        variants: variants.map((v) => ({
          ...(v.sku ? { sku: v.sku } : {}),
          attributes: Object.fromEntries(v.attributesText.split(',').map((s) => s.trim().split('=').map((x) => x.trim())).filter(([, val]) => val)),
          pricePaise: Math.round(parseFloat(v.price || '0') * 100),
          compareAtPaise: v.mrp ? Math.round(parseFloat(v.mrp) * 100) : null,
          stock: parseInt(v.stock || '0', 10),
        })),
      };
      if (isNew) await api.post('/api/admin/products', payload);
      else await api.patch(`/api/admin/products/${id}`, payload);
      nav('/admin');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <>
      <h1>{isNew ? 'New product' : 'Edit product'}</h1>
      {err && <div className="alert alert-error">{err}</div>}
      <div className="form-card" style={{ maxWidth: 760 }}>
        <Field label="Title"><input value={form.title} onChange={set('title')} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <Field label="Brand"><input value={form.brand} onChange={set('brand')} placeholder="Khaas" /></Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option>
            </select>
          </Field>
        </div>
        <Field label="Category">
          <select value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Choose…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Description"><textarea rows={4} value={form.description} onChange={set('description')} /></Field>
        <ImageUploader media={media} setMedia={setMedia} />
        <h3>Variants <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(price in ₹)</small></h3>
        {variants.map((v, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <input placeholder="size=M" value={v.attributesText} onChange={setV(i, 'attributesText')} aria-label="attributes" />
            <input placeholder="Price" value={v.price} onChange={setV(i, 'price')} inputMode="decimal" aria-label="price" />
            <input placeholder="MRP" value={v.mrp} onChange={setV(i, 'mrp')} inputMode="decimal" aria-label="mrp" />
            <input placeholder="Stock" value={v.stock} onChange={setV(i, 'stock')} inputMode="numeric" aria-label="stock" />
            <button className="btn btn-ghost btn-sm" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={() => setVariants([...variants, blankVariant()])}>+ Add variant</button>
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save product'}</button>
          <button className="btn btn-ghost" onClick={() => nav('/admin')}>Cancel</button>
        </div>
      </div>
    </>
  );
}

