import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ProductCard, SkeletonGrid, Empty, Pagination } from '../components/ui.jsx';

const SORTS = [['new', 'Newest'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low']];

export default function Catalog() {
  const { slug } = useParams(); // category slug (undefined on /search)
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [cats, setCats] = useState([]);

  const q = params.get('q') || '';
  const sort = params.get('sort') || 'new';
  const page = parseInt(params.get('page') || '1', 10);

  useEffect(() => { api.get('/api/categories').then((d) => setCats(d.categories)).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    const qs = new URLSearchParams({ limit: '12', page: String(page), sort });
    if (q) qs.set('q', q);
    if (slug) qs.set('category', slug);
    api.get(`/api/products?${qs}`).then(setData).catch(() => setData({ items: [], total: 0, pages: 0 }));
    window.scrollTo(0, 0);
  }, [q, slug, sort, page]);

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    next.delete('page');
    setParams(next);
  };

  const title = slug ? (cats.find((c) => c.slug === slug)?.name || 'Category') : (q ? `Results for “${q}”` : 'All products');

  return (
    <>
      <h1>{title}</h1>
      <p className="lead">{data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ' '}</p>
      <div className="filters">
        <select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {!slug && (
          <select value="" onChange={(e) => e.target.value && (window.location.href = `/category/${e.target.value}`)} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        )}
      </div>
      {data === null ? <SkeletonGrid /> : data.items.length === 0 ? (
        <Empty icon="🔍" title="Nothing found" text="Try a different search or browse the categories." action={<a className="btn btn-primary" href="/search">Browse all</a>} />
      ) : (
        <>
          <div className="grid">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          <Pagination page={page} pages={data.pages} onPage={(p) => set('page', String(p))} />
        </>
      )}
    </>
  );
}
