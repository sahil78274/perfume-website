import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, fmtDateTime, pillClass, ORDER_STATUSES } from '../utils/format';
import { useToast } from '../context/ToastContext';

const SUPPLIER_STATUSES = ['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'];

export default function Suppliers() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [supplierStatus, setSupplierStatus] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const debounce = useRef(null);

  const fetchOrders = useCallback(async (filters, targetPage) => {
    setState('loading');
    try {
      const params = { page: targetPage, limit: 20 };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.supplierStatus) params.supplierStatus = filters.supplierStatus;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/admin/suppliers/orders', { params });
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setState('ready');
    } catch (err) {
      setOrders([]);
      setError(err.message || 'Could not load supplier orders.');
      setState('error');
    }
  }, []);

  const currentFilters = () => ({ search, supplierStatus, status });
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

  const changeSupplierStatus = async (order, nextStatus) => {
    if (nextStatus === order.supplierStatus) return;
    setSavingId(order.id);
    try {
      await api.patch(`/admin/orders/${encodeURIComponent(order.orderNumber)}/supplier`, { supplierStatus: nextStatus });
      setOrders((rows) => rows.map((r) => (r.id === order.id ? { ...r, supplierStatus: nextStatus } : r)));
      toast(`Supplier status for ${order.orderNumber} set to “${nextStatus}”.`, 'success');
    } catch (err) {
      toast(err.message || 'Could not update supplier status.', 'error');
    } finally {
      setSavingId('');
    }
  };

  const pendingCount = orders.filter((o) => o.supplierStatus === 'Not placed').length;

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Procurement</div><h1>Supplier Management</h1></div>
        <span className="muted no-print" style={{ fontSize: 12 }}>Dropship fulfilment (e.g. Meesho) for every order. Costs are admin-only.</span>
      </div>

      <form className="filters no-print" onSubmit={applyFilters}>
        <div style={{ minWidth: 230, flex: 1 }}><label className="field-label" htmlFor="supSearch">Search (order ID / customer / supplier ID / tracking)</label>
          <input type="text" id="supSearch" placeholder="SC-261123-0001, name, Meesho ID or tracking…" style={{ width: '100%' }} value={search} onChange={(e) => onSearchChange(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="supStatus">Supplier status</label>
          <select id="supStatus" value={supplierStatus} onChange={(e) => setSupplierStatus(e.target.value)}>
            <option value="">All supplier statuses</option>
            {SUPPLIER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label className="field-label" htmlFor="supOrderStatus">Order status</label>
          <select id="supOrderStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All order statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <button type="submit" className="btn btn-sm">Apply</button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setSupplierStatus(''); setStatus(''); setPage(1); fetchOrders({ search: '', supplierStatus: '', status: '' }, 1); }}>Reset</button>
      </form>

      {state === 'ready' && pendingCount > 0 && supplierStatus !== 'Not placed' ? (
        <p className="warn" style={{ marginBottom: 10 }}>⚠ {pendingCount} order(s) on this page still show “Not placed” with the supplier.</p>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Order</th><th>Supplier status</th><th>Supplier ID</th><th>Tracking</th><th>Cost</th><th>Total</th><th className="no-print"></th></tr></thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan="10" className="empty">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan="10" className="empty">{error}</td></tr>}
            {state === 'ready' && orders.length === 0 && <tr><td colSpan="10" className="empty">No orders match those filters.</td></tr>}
            {state === 'ready' && orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/admin/orders/${o.orderNumber}`}>{o.orderNumber}</Link>{o.isGuest ? <><br /><small className="muted">guest</small></> : null}</td>
                <td>{fmtDateTime(o.createdAt)}</td>
                <td>{o.customerName}<br /><small className="muted">{o.phone}</small></td>
                <td><span className={pillClass(o.status)}>{o.status}</span></td>
                <td>
                  <select
                    aria-label={`Supplier status for ${o.orderNumber}`}
                    value={o.supplierStatus}
                    disabled={savingId === o.id}
                    onChange={(e) => changeSupplierStatus(o, e.target.value)}
                    style={{ minWidth: 128 }}
                  >
                    {SUPPLIER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>{o.supplierOrderId || <span className="muted">—</span>}</td>
                <td>{o.trackingRef || <span className="muted">—</span>}</td>
                <td>{o.supplierPurchaseCost !== null && o.supplierPurchaseCost !== undefined ? money(o.supplierPurchaseCost) : <span className="muted">—</span>}</td>
                <td>{money(o.total)}</td>
                <td className="no-print"><Link className="btn btn-outline btn-sm" to={`/admin/orders/${o.orderNumber}`}>Fulfil →</Link></td>
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
