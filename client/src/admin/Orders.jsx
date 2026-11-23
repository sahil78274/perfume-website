import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { money, fmtDateTime, pillClass, ORDER_STATUSES } from '../utils/format';

export default function Orders() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const debounce = useRef(null);

  const fetchOrders = useCallback(async (filters, targetPage) => {
    setState('loading');
    try {
      const params = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const { data } = await api.get('/admin/orders', { params: { ...params, page: targetPage, limit: 20 } });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setState('ready');
    } catch (err) {
      setOrders([]);
      setError(err.message || 'Could not load orders.');
      setState('error');
    }
  }, []);

  const currentFilters = () => ({ search, status, from, to });

  useEffect(() => { fetchOrders(currentFilters(), page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchOrders(currentFilters(), 1);
  };

  const onSearchChange = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchOrders({ ...currentFilters(), search: value }, 1); }, 350);
  };

  const resetFilters = () => {
    setSearch(''); setStatus(''); setFrom(''); setTo(''); setPage(1);
    fetchOrders({ search: '', status: '', from: '', to: '' }, 1);
  };

  const exportCsv = () => {
    const f = currentFilters();
    const params = new URLSearchParams();
    if (f.search.trim()) params.set('search', f.search.trim());
    if (f.status) params.set('status', f.status);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    window.location.href = `/api/admin/orders/export.csv?${params.toString()}`;
  };

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Fulfilment</div><h1>Orders</h1></div>
        <button type="button" className="btn btn-outline btn-sm no-print" onClick={exportCsv}>⭳ Export CSV</button>
      </div>

      <form className="filters no-print" onSubmit={applyFilters}>
        <div style={{ minWidth: 220, flex: 1 }}><label className="field-label" htmlFor="orderSearch">Search (order ID / name / phone)</label>
          <input type="text" id="orderSearch" placeholder="SC-261123-0001, name or mobile…" style={{ width: '100%' }} value={search} onChange={(e) => onSearchChange(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="orderStatusFilter">Status</label>
          <select id="orderStatusFilter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label className="field-label" htmlFor="orderFrom">From</label><input type="date" id="orderFrom" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="orderTo">To</label><input type="date" id="orderTo" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button type="submit" className="btn btn-sm">Apply</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>Reset</button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Phone</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan="7" className="empty">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan="7" className="empty">{error}</td></tr>}
            {state === 'ready' && orders.length === 0 && <tr><td colSpan="7" className="empty">No orders match those filters.</td></tr>}
            {state === 'ready' && orders.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/orders/${o.orderNumber}`)}>
                <td><Link to={`/admin/orders/${o.orderNumber}`} onClick={(e) => e.stopPropagation()}>{o.orderNumber}</Link>{o.isGuest ? <><br /><small className="muted">guest</small></> : null}</td>
                <td>{fmtDateTime(o.createdAt)}</td>
                <td>{o.name}</td>
                <td><a href={`tel:${o.phone}`} style={{ color: 'inherit', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{o.phone}</a></td>
                <td>{o.itemsCount}</td>
                <td>{money(o.total)}</td>
                <td><span className={pillClass(o.status)}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
        <span className="muted">{state === 'ready' && `${total} order(s) · page ${page} of ${pages}`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
        </div>
      </div>
    </>
  );
}
