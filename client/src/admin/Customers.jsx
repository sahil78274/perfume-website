import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, fmtDate, fmtDateTime, pillClass } from '../utils/format';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounce = useRef(null);

  const fetchCustomers = useCallback(async (searchValue, targetPage) => {
    setState('loading');
    try {
      const params = { page: targetPage, limit: 20 };
      if (searchValue.trim()) params.search = searchValue.trim();
      const { data } = await api.get('/admin/customers', { params });
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setState('ready');
    } catch (err) {
      setCustomers([]);
      setError(err.message || 'Could not load customers.');
      setState('error');
    }
  }, []);

  useEffect(() => { fetchCustomers(search, page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers(search, 1);
  };
  const onSearchChange = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchCustomers(value, 1); }, 350);
  };

  const openDetail = async (id) => {
    setDetailLoading(true);
    setDetail({ id });
    try {
      const { data } = await api.get(`/admin/customers/${encodeURIComponent(id)}`);
      setDetail(data.customer);
    } catch (err) {
      setDetail({ id, error: err.message || 'Could not load the customer.' });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <div className="topbar"><div><div className="crumb">Relationships</div><h1>Customers</h1></div></div>
      <form className="filters no-print" onSubmit={applySearch}>
        <div style={{ minWidth: 220, flex: 1 }}><label className="field-label" htmlFor="customerSearch">Search</label>
          <input type="text" id="customerSearch" placeholder="Name, phone or email…" style={{ width: '100%' }} value={search} onChange={(e) => onSearchChange(e.target.value)} /></div>
        <button type="submit" className="btn btn-sm">Search</button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Delivered</th><th>Cancelled/RTO</th><th>Delivered spend</th><th>Last order</th></tr></thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan="7" className="empty">Loading…</td></tr>}
            {state === 'error' && <tr><td colSpan="7" className="empty">{error}</td></tr>}
            {state === 'ready' && customers.length === 0 && <tr><td colSpan="7" className="empty">No customers found.</td></tr>}
            {state === 'ready' && customers.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c.id)}>
                <td><b>{c.name}</b><br /><small className="muted">{c.email || 'no email'}</small></td>
                <td>{c.phone}</td>
                <td>{c.totalOrders}</td>
                <td>{c.deliveredOrders}</td>
                <td>{c.cancelledRtoOrders}</td>
                <td>{money(c.deliveredSpend)}</td>
                <td>{c.lastOrderAt ? fmtDate(c.lastOrderAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span className="muted">{state === 'ready' && `${total} customer(s) · page ${page} of ${pages}`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
        </div>
      </div>

      {detail && (
        <div className="panel" id="customerDetailPanel">
          {detailLoading && <div className="empty">Loading customer…</div>}
          {!detailLoading && detail.error && <div className="empty">{detail.error}</div>}
          {!detailLoading && !detail.error && (
            <>
              <div className="panel-title"><h2 style={{ margin: 0 }}>{detail.name}</h2><button type="button" className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>Close</button></div>
              <div className="two-col">
                <div>
                  <div className="kv"><span>Mobile</span><span><a href={`tel:${detail.phone}`}>{detail.phone}</a></span></div>
                  <div className="kv"><span>Email</span><span>{detail.email || '—'}</span></div>
                  <div className="kv"><span>Registered</span><span>{fmtDateTime(detail.registeredAt)}</span></div>
                  <div className="kv"><span>Last login</span><span>{detail.lastLoginAt ? fmtDateTime(detail.lastLoginAt) : '—'}</span></div>
                  <div className="kv"><span>Promo consent</span><span>{detail.promoConsent ? 'Yes — opted in' : 'No'}</span></div>
                </div>
                <div>
                  <div className="kv"><span>Total orders</span><span><b>{detail.stats?.totalOrders ?? '—'}</b></span></div>
                  <div className="kv"><span>Delivered</span><span>{detail.stats?.deliveredOrders ?? '—'}</span></div>
                  <div className="kv"><span>Cancelled / RTO</span><span>{detail.stats?.cancelledRtoOrders ?? '—'}</span></div>
                  <div className="kv"><span>Delivered spend</span><span><b>{money(detail.stats?.deliveredSpend)}</b></span></div>
                </div>
              </div>
              <h2 style={{ marginTop: 14 }}>Saved addresses</h2>
              {(detail.addresses || []).length
                ? detail.addresses.map((a, i) => (
                    <div key={i} className="kv"><span><b>{a.label}</b>{a.isDefault ? ' (default)' : ''}<br /><small className="muted">{a.fullName} · {a.phone}</small></span><span style={{ maxWidth: '55%', textAlign: 'right' }}>{[a.houseAndStreet, a.area, a.city, a.state].filter(Boolean).join(', ')} · PIN {a.pincode}</span></div>
                  ))
                : <div className="empty">No saved addresses.</div>}
              <h2 style={{ marginTop: 14 }}>Recent orders</h2>
              {(detail.orders || []).length
                ? detail.orders.map((o) => (
                    <div key={o.orderNumber} className="kv"><span><Link to={`/admin/orders/${o.orderNumber}`}><b>{o.orderNumber}</b></Link><br /><small className="muted">{fmtDate(o.createdAt)} · {o.itemsCount} item(s) · COD</small></span><span style={{ textAlign: 'right' }}>{money(o.total)}<br /><span className={pillClass(o.status)}>{o.status}</span></span></div>
                  ))
                : <div className="empty">No orders yet.</div>}
            </>
          )}
        </div>
      )}
    </>
  );
}
