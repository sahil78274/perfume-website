import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { money, fmtDate, fmtDateTime, fmtDateInput, pillClass, ORDER_STATUSES } from '../utils/format';
import { useToast } from '../context/ToastContext';

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const [status, setStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [supplier, setSupplier] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [expense, setExpense] = useState({ type: 'shipping', amount: '', note: '' });
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { data } = await api.get(`/admin/orders/${encodeURIComponent(orderNumber)}`);
      const o = data.order;
      setOrder(o);
      setStatus(o.status);
      setSupplier({
        supplierName: o.supplier?.supplierName || '',
        supplierProductRef: o.supplier?.supplierProductRef || '',
        supplierOrderId: o.supplier?.supplierOrderId || '',
        supplierPurchaseCost: o.supplier?.supplierPurchaseCost ?? '',
        supplierOrderDate: o.supplier?.supplierOrderDate ? fmtDateInput(o.supplier.supplierOrderDate) : '',
        trackingRef: o.supplier?.trackingRef || '',
        supplierStatus: o.supplier?.supplierStatus || 'Not placed',
        fulfilmentNotes: o.supplier?.fulfilmentNotes || ''
      });
      setState('ready');
      document.title = `Order ${o.orderNumber} — SCENTORA Admin`;
    } catch (err) {
      setError(err.message || 'Could not load the order.');
      setState('error');
    }
  }, [orderNumber]);

  useEffect(() => { load(); return () => { document.title = 'SCENTORA Admin'; }; }, [load]);

  const updateStatus = async (e) => {
    e.preventDefault();
    setBusy('status');
    try {
      const { data } = await api.patch(`/admin/orders/${encodeURIComponent(order.orderNumber)}/status`, { status, note: statusNote.trim() });
      toast(`Order marked as ${status}.`, 'success');
      setStatusNote('');
      setOrder(data.order);
      setStatus(data.order.status);
    } catch (err) {
      toast(err.message || 'Could not update status.', 'error');
    } finally {
      setBusy('');
    }
  };

  const saveSupplier = async (e) => {
    e.preventDefault();
    setBusy('supplier');
    try {
      await api.patch(`/admin/orders/${encodeURIComponent(order.orderNumber)}/supplier`, {
        ...supplier,
        supplierPurchaseCost: supplier.supplierPurchaseCost === '' ? null : Number(supplier.supplierPurchaseCost),
        supplierOrderDate: supplier.supplierOrderDate || null
      });
      toast('Supplier details saved.', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not save supplier details.', 'error');
    } finally {
      setBusy('');
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    const text = noteText.trim();
    if (text.length < 2) { toast('Note is too short.', 'error'); return; }
    setBusy('note');
    try {
      await api.post(`/admin/orders/${encodeURIComponent(order.orderNumber)}/notes`, { text });
      setNoteText('');
      load();
    } catch (err) {
      toast(err.message || 'Could not add the note.', 'error');
    } finally {
      setBusy('');
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await api.delete(`/admin/orders/${encodeURIComponent(order.orderNumber)}/notes/${encodeURIComponent(noteId)}`);
      toast('Note removed.');
      load();
    } catch (err) {
      toast(err.message || 'Could not remove the note.', 'error');
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount < 0) { toast('Enter a valid amount.', 'error'); return; }
    setBusy('expense');
    try {
      await api.post(`/admin/orders/${encodeURIComponent(order.orderNumber)}/expenses`, { type: expense.type, amount, note: expense.note.trim() });
      setExpense({ type: 'shipping', amount: '', note: '' });
      toast('Expense added.', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Could not add expense.', 'error');
    } finally {
      setBusy('');
    }
  };

  const deleteExpense = async (id) => {
    try {
      await api.delete(`/admin/expenses/${encodeURIComponent(id)}`);
      toast('Expense removed.');
      load();
    } catch (err) {
      toast(err.message || 'Could not remove the expense.', 'error');
    }
  };

  if (state === 'loading') return <div className="empty">Loading order…</div>;
  if (state === 'error') return (
    <>
      <div className="topbar"><div><div className="crumb"><Link to="/admin/orders" style={{ color: 'var(--gold)', textDecoration: 'none' }}>← Orders</Link></div><h1>Order</h1></div></div>
      <div className="empty">Could not load the order: {error}</div>
    </>
  );

  const o = order;
  const addr = o.shippingAddress || {};
  const addressLine = [addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', ');
  const profit = o.profit || null;

  return (
    <>
      <div className="topbar no-print">
        <div><div className="crumb"><Link to="/admin/orders" style={{ color: 'var(--gold)', textDecoration: 'none' }}>← Orders</Link></div><h1>Order {o.orderNumber}</h1></div>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨 Print</button></div>
      </div>

      <div id="printArea">
        <div className="order-grid">
          <div>
            <div className="panel">
              <h2>Items <span className="muted" style={{ fontSize: 11 }}>· {o.itemsCount} item(s) · COD</span></h2>
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="data">
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line total</th><th>Supplier cost (per unit)</th></tr></thead>
                  <tbody>
                    {(o.items || []).map((i) => {
                      const imageUrl = i.image || '/images/product-placeholder.svg';
                      return (
                        <tr key={i.id}>
                          <td>
                            <div className="admin-order-product">
                              <a className="admin-order-thumb-link" href={imageUrl} target="_blank" rel="noreferrer" aria-label={`View larger image of ${i.name}`}>
                                <img
                                  className="admin-order-thumb"
                                  src={imageUrl}
                                  alt={i.name}
                                  loading="lazy"
                                  onError={(event) => {
                                    if (!event.currentTarget.src.endsWith('/images/product-placeholder.svg')) {
                                      event.currentTarget.src = '/images/product-placeholder.svg';
                                      event.currentTarget.closest('a').href = '/images/product-placeholder.svg';
                                    }
                                  }}
                                />
                              </a>
                              <div className="admin-order-product-details">
                                <strong>{i.name}</strong>
                                {(i.selectedVariant || i.variant) && <small>{i.selectedVariant || i.variant}</small>}
                              </div>
                            </div>
                          </td>
                          <td>{i.qty}</td>
                          <td>{money(i.unitPrice)}</td>
                          <td>{money(i.lineTotal)}</td>
                          <td className="muted">{i.supplierCost !== null && i.supplierCost !== undefined ? money(i.supplierCost) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="kv" style={{ marginTop: 8 }}><span>Items subtotal</span><span>{money(o.itemsSubtotal)}</span></div>
              <div className="kv"><span>Shipping</span><span>{o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
              <div className="kv"><span><b>Order total</b></span><span><b style={{ fontSize: 16 }}>{money(o.total)}</b> · Collect COD</span></div>
            </div>

            <div className="panel">
              <h2>Customer &amp; delivery</h2>
              <div className="kv"><span>Name</span><span><b>{o.contact.name}</b>{o.isGuest ? ' (guest)' : ' (account)'}</span></div>
              <div className="kv"><span>Mobile</span><span><a href={`tel:${o.contact.phone}`}>{o.contact.phone}</a></span></div>
              <div className="kv"><span>Email</span><span>{o.contact.email || '—'}</span></div>
              <div className="kv"><span>Address</span><span style={{ maxWidth: '60%', textAlign: 'right' }}>{addressLine}<br />PIN {addr.pincode}{addr.landmark ? ` · Landmark: ${addr.landmark}` : ''}</span></div>
              {o.notes && <div className="kv"><span>Customer notes</span><span>{o.notes}</span></div>}
              <div className="kv"><span>Placed</span><span>{fmtDateTime(o.createdAt)}</span></div>
              <div className="kv"><span>Payment</span><span>Cash on Delivery</span></div>
              <div className="kv"><span>Confirmation email</span><span>{o.emailStatus || 'pending'}</span></div>
            </div>

            <div className="panel no-print">
              <h2>Update order status</h2>
              <form onSubmit={updateStatus} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <div className="field" style={{ minWidth: 210, margin: 0 }}><label className="field-label" htmlFor="statusSelect">New status</label>
                  <select id="statusSelect" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div className="field" style={{ flex: 1, minWidth: 180, margin: 0 }}><label className="field-label" htmlFor="statusNote">Note (optional, recorded in history)</label>
                  <input type="text" id="statusNote" maxLength={500} placeholder="e.g. Handed to Delhivery AWB 123456" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} /></div>
                <button type="submit" className="btn btn-gold" disabled={busy === 'status'}>{busy === 'status' ? 'Updating…' : 'Update status'}</button>
              </form>
              <p className="muted" style={{ fontSize: 10.5, margin: '8px 0 0' }}>Moving to Cancelled / RTO / Returned restores stock automatically (once). Moving back to an active state re-deducts stock when available. Every change is recorded with timestamp and your name.</p>
            </div>

            <div className="panel">
              <h2>Status history</h2>
              <ul className="timeline">
                {(o.timeline || []).length
                  ? o.timeline.map((t) => <li key={t.id}><b>{t.status}</b> — {t.changedByName || 'System'}<br /><small>{fmtDateTime(t.at)}{t.note ? ' · ' + t.note : ''}</small></li>)
                  : <li>No history yet.</li>}
              </ul>
            </div>

            <div className="panel no-print">
              <h2>Internal admin notes</h2>
              {(o.adminNotes || []).length
                ? o.adminNotes.map((n) => (
                    <div key={n.id} className="kv"><span><b>{n.adminName || 'Admin'}</b> · <small className="muted">{fmtDateTime(n.createdAt)}</small><br />{n.text}</span><button type="button" className="linkish" onClick={() => deleteNote(n.id)}>Remove</button></div>
                  ))
                : <div className="empty">No internal notes yet.</div>}
              <form onSubmit={addNote} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input type="text" maxLength={1000} placeholder="Add an internal note (never shown to the customer)…" style={{ flex: 1, padding: '9px 10px', border: '1px solid #d8d4c9', borderRadius: 5 }} autoComplete="off" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button type="submit" className="btn btn-sm" disabled={busy === 'note'}>Add note</button>
              </form>
            </div>
          </div>

          <div>
            <div className="panel no-print">
              <h2>Supplier fulfilment <span className="muted" style={{ fontSize: 10 }}>(private — admins only)</span></h2>
              <p className="muted" style={{ fontSize: 10.5, marginTop: -6 }}>Your manual Meesho / supplier workflow. These details and costs are never shown to customers.</p>
              {supplier && (
                <form onSubmit={saveSupplier}>
                  <div className="field"><label className="field-label" htmlFor="supName">Supplier name</label>
                    <input type="text" id="supName" maxLength={120} placeholder="e.g. Meesho — Sharma Traders" value={supplier.supplierName} onChange={(e) => setSupplier({ ...supplier, supplierName: e.target.value })} /></div>
                  <div className="two-col">
                    <div className="field"><label className="field-label" htmlFor="supProductRef">Supplier product ref</label>
                      <input type="text" id="supProductRef" maxLength={160} placeholder="SKU / listing ID" value={supplier.supplierProductRef} onChange={(e) => setSupplier({ ...supplier, supplierProductRef: e.target.value })} /></div>
                    <div className="field"><label className="field-label" htmlFor="supOrderId">Supplier order ID</label>
                      <input type="text" id="supOrderId" maxLength={120} placeholder="Meesho order number" value={supplier.supplierOrderId} onChange={(e) => setSupplier({ ...supplier, supplierOrderId: e.target.value })} /></div>
                    <div className="field"><label className="field-label" htmlFor="supCost">Purchase cost (₹, total)</label>
                      <input type="number" id="supCost" min="0" step="0.01" placeholder="What you pay supplier" value={supplier.supplierPurchaseCost} onChange={(e) => setSupplier({ ...supplier, supplierPurchaseCost: e.target.value })} /></div>
                    <div className="field"><label className="field-label" htmlFor="supDate">Supplier order date</label>
                      <input type="date" id="supDate" value={supplier.supplierOrderDate} onChange={(e) => setSupplier({ ...supplier, supplierOrderDate: e.target.value })} /></div>
                    <div className="field"><label className="field-label" htmlFor="supTracking">Tracking reference</label>
                      <input type="text" id="supTracking" maxLength={160} placeholder="AWB / tracking no." value={supplier.trackingRef} onChange={(e) => setSupplier({ ...supplier, trackingRef: e.target.value })} /></div>
                    <div className="field"><label className="field-label" htmlFor="supStatus">Supplier status</label>
                      <select id="supStatus" value={supplier.supplierStatus} onChange={(e) => setSupplier({ ...supplier, supplierStatus: e.target.value })}>
                        {['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select></div>
                  </div>
                  <div className="field"><label className="field-label" htmlFor="supNotes">Fulfilment notes</label>
                    <textarea id="supNotes" maxLength={2000} placeholder="Anything about packaging, delay, replacement…" value={supplier.fulfilmentNotes} onChange={(e) => setSupplier({ ...supplier, fulfilmentNotes: e.target.value })} /></div>
                  <button type="submit" className="btn" disabled={busy === 'supplier'}>{busy === 'supplier' ? 'Saving…' : 'Save supplier details'}</button>
                </form>
              )}
            </div>

            <div className="panel no-print">
              <h2>Expenses for this order</h2>
              {(o.expenses || []).length
                ? o.expenses.map((e) => (
                    <div key={e.id} className="kv"><span>{e.type}{e.note ? ' — ' : ''}{e.note ? e.note : ''}<br /><small className="muted">{fmtDate(e.expenseDate)}</small></span><span><b>{money(e.amount)}</b> <button type="button" className="linkish" style={{ marginLeft: 8 }} onClick={() => deleteExpense(e.id)}>Remove</button></span></div>
                  ))
                : <div className="empty">No expenses recorded for this order yet.</div>}
              <form onSubmit={addExpense} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'end' }}>
                <div className="field" style={{ width: 130, margin: 0 }}><label className="field-label" htmlFor="oeType">Type</label>
                  <select id="oeType" value={expense.type} onChange={(e) => setExpense({ ...expense, type: e.target.value })}>
                    <option value="shipping">Shipping</option><option value="cod">COD charge</option><option value="advertising">Advertising</option><option value="rto">RTO / return</option><option value="other">Other</option>
                  </select></div>
                <div className="field" style={{ width: 110, margin: 0 }}><label className="field-label" htmlFor="oeAmount">Amount ₹</label>
                  <input type="number" id="oeAmount" min="0" step="0.01" required placeholder="0.00" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} /></div>
                <div className="field" style={{ flex: 1, minWidth: 120, margin: 0 }}><label className="field-label" htmlFor="oeNote">Note</label>
                  <input type="text" id="oeNote" maxLength={400} placeholder="Optional" value={expense.note} onChange={(e) => setExpense({ ...expense, note: e.target.value })} /></div>
                <button type="submit" className="btn btn-sm" disabled={busy === 'expense'}>Add</button>
              </form>
            </div>

            <div className="panel">
              <h2>Profit breakdown</h2>
              {!profit || profit.netProfit === null || profit.netProfit === undefined ? (
                <div className="empty">No supplier cost data yet — enter the supplier purchase cost (or per-product supplier costs) to see profit.</div>
              ) : (
                <>
                  <div className="kv"><span>Merchandise revenue</span><span>{money(o.itemsSubtotal)}</span></div>
                  <div className="kv"><span>Supplier cost <small className="muted">({profit.costSource === 'supplier' ? 'actual, from supplier entry' : profit.costSource === 'product' ? 'estimated from product costs' : 'unknown'})</small></span><span>- {money(profit.cost)}</span></div>
                  <div className="kv"><span>Gross product margin</span><span><b>{money(profit.grossMargin)}</b></span></div>
                  <div className="kv"><span>Recorded expenses</span><span>- {money(profit.expenseTotal)}</span></div>
                  <div className="kv"><span>Estimated net profit</span><span><b style={{ fontSize: 16, color: profit.netProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{money(profit.netProfit)}</b></span></div>
                  <p className="muted" style={{ fontSize: 10.5, margin: '8px 0 0' }}>Expense mix: shipping {money(profit.expenses?.shipping)} · COD {money(profit.expenses?.cod)} · ads {money(profit.expenses?.advertising)} · RTO {money(profit.expenses?.rto)} · other {money(profit.expenses?.other)}. Cancelled / RTO / Returned orders are excluded from sales and revenue figures.</p>
                </>
              )}
              {profit && profit.costSource === 'none' && <p className="muted" style={{ fontSize: 10.5 }}>Tip: fill in the supplier purchase cost on this order (or per-product supplier costs in Products) to unlock real profit numbers.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
