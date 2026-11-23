import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { money } from '../utils/format';
import { useToast } from '../context/ToastContext';

export default function Inventory() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState(''); // '' | 'low' | 'out'
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [defaultThreshold, setDefaultThreshold] = useState(5);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editStock, setEditStock] = useState('');
  const [busy, setBusy] = useState('');
  const debounce = useRef(null);

  const fetchInventory = useCallback(async (filters, targetPage) => {
    setState('loading');
    try {
      const params = { page: targetPage, limit: 25 };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.stock) params.stock = filters.stock;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/admin/inventory', { params });
      setProducts(data.products || []);
      setSummary(data.summary || null);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setDefaultThreshold(data.defaultThreshold ?? 5);
      setState('ready');
    } catch (err) {
      setProducts([]);
      setError(err.message || 'Could not load the inventory.');
      setState('error');
    }
  }, []);

  const currentFilters = () => ({ search, stock, status });
  useEffect(() => { fetchInventory(currentFilters(), page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchInventory(currentFilters(), 1);
  };
  const onSearchChange = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchInventory({ ...currentFilters(), search: value }, 1); }, 350);
  };

  const beginEdit = (p) => { setEditingId(p.id); setEditStock(String(p.stock)); };
  const cancelEdit = () => { setEditingId(null); setEditStock(''); };
  const saveStock = async (p) => {
    const next = Math.floor(Number(editStock));
    if (!Number.isFinite(next) || next < 0) { toast('Stock must be a non-negative whole number.', 'error'); return; }
    setBusy(p.id);
    try {
      await api.patch(`/admin/products/${encodeURIComponent(p.id)}`, { stock: next });
      toast(`Stock updated for “${p.name}”.`, 'success');
      setEditingId(null);
      fetchInventory(currentFilters(), page);
    } catch (err) {
      toast(err.message || 'Could not update stock.', 'error');
    } finally {
      setBusy('');
    }
  };

  const stockBadge = (p) => {
    if (p.stock <= 0) return <span className="pill pill-cancelled">Out of stock</span>;
    if (p.stock <= p.effectiveThreshold) return <span className="pill pill-new">Low stock</span>;
    return <span className="pill pill-delivered">In stock</span>;
  };

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Catalogue</div><h1>Inventory</h1></div>
        <span className="muted no-print" style={{ fontSize: 12 }}>Default low-stock alert at {defaultThreshold} units · override per product in Products</span>
      </div>

      <div className="stats-grid" style={{ marginBottom: 14 }}>
        <div className="stat"><small>Units in stock</small><b>{summary ? summary.totalUnits.toLocaleString('en-IN') : '—'}</b></div>
        <div className="stat"><small>Out of stock</small><b>{summary ? summary.outOfStock : '—'}</b></div>
        <div className="stat"><small>Low stock</small><b>{summary ? summary.lowStock : '—'}</b></div>
        <div className="stat"><small>Retail value</small><b>{summary ? money(summary.retailValue) : '—'}</b></div>
        <div className="stat"><small>Cost value</small><b>{summary ? money(summary.costValue) : '—'}</b></div>
      </div>
      {summary && summary.noCostProducts > 0 ? (
        <p className="warn" style={{ marginBottom: 12 }}>⚠ {summary.noCostProducts} product(s) have no supplier cost recorded — profit for orders containing them will show as “unknown” until a cost is set in Products.</p>
      ) : null}

      <form className="filters no-print" onSubmit={applyFilters}>
        <div style={{ minWidth: 220, flex: 1 }}><label className="field-label" htmlFor="invSearch">Search (name / SKU)</label>
          <input type="text" id="invSearch" placeholder="Product name or SKU…" style={{ width: '100%' }} value={search} onChange={(e) => onSearchChange(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="invStock">Stock level</label>
          <select id="invStock" value={stock} onChange={(e) => setStock(e.target.value)}>
            <option value="">All levels</option>
            <option value="low">Low stock only</option>
            <option value="out">Out of stock only</option>
          </select></div>
        <div><label className="field-label" htmlFor="invStatus">Status</label>
          <select id="invStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="">All</option>
          </select></div>
        <button type="submit" className="btn btn-sm">Apply</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setStock(''); setStatus('active'); setPage(1); fetchInventory({ search: '', stock: '', status: 'active' }, 1); }}>Reset</button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Alert at</th><th>Price</th><th>Stock value</th><th>State</th><th className="no-print">Quick edit</th></tr></thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan="8" className="empty">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan="8" className="empty">{error}</td></tr>}
            {state === 'ready' && products.length === 0 && <tr><td colSpan="8" className="empty">Nothing matches those filters.</td></tr>}
            {state === 'ready' && products.map((p) => (
              <tr key={p.id}>
                  <td><b>{p.name}</b><br /><small className="muted">{p.sku}{p.status === 'inactive' ? ' · inactive' : ''}</small></td>
                  <td>{p.category || '—'}</td>
                  <td><b>{p.stock}</b></td>
                  <td>{p.effectiveThreshold}{p.lowStockThreshold === null ? <small className="muted"> (default)</small> : null}</td>
                  <td>{money(p.price)}</td>
                  <td>{money(p.stockValue)}</td>
                  <td>{stockBadge(p)}</td>
                  <td className="no-print">
                    {editingId === p.id ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="number" min="0" step="1" value={editStock} onChange={(e) => setEditStock(e.target.value)} style={{ width: 76 }} aria-label="New stock quantity" />
                        <button type="button" className="btn btn-sm" disabled={busy === p.id} onClick={() => saveStock(p)}>{busy === p.id ? 'Saving…' : 'Save'}</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={cancelEdit}>✕</button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => beginEdit(p)}>Edit stock</button>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
        <span className="muted">{state === 'ready' && `${total} product(s) · page ${page} of ${pages}`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
        </div>
      </div>
    </>
  );
}
