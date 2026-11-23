import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { money, fmtDate, fmtDateInput } from '../utils/format';
import { useToast } from '../context/ToastContext';

const EXPENSE_TYPES = [
  { value: 'shipping', label: 'Shipping' },
  { value: 'cod', label: 'COD charge' },
  { value: 'advertising', label: 'Advertising' },
  { value: 'rto', label: 'RTO' },
  { value: 'other', label: 'Other' }
];

const emptyForm = () => ({ type: 'shipping', amount: '', note: '', expenseDate: fmtDateInput(new Date()), orderNumber: '' });

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDateInput(d);
}

export default function Finance() {
  const { toast } = useToast();
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(fmtDateInput(new Date()));
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState(null);
  const [summaryState, setSummaryState] = useState('loading');
  const [expenses, setExpenses] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [ledgerState, setLedgerState] = useState('loading');

  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const loadSummary = useCallback(async (f, t) => {
    setSummaryState('loading');
    try {
      const { data } = await api.get('/admin/dashboard', { params: { from: f || undefined, to: t || undefined } });
      setSummary(data.stats || null);
      setSummaryState('ready');
    } catch (err) {
      setSummary(null);
      setSummaryState('error');
      toast(err.message || 'Could not load the profit summary.', 'error');
    }
  }, [toast]);

  const loadLedger = useCallback(async (f, t, expenseType, targetPage) => {
    setLedgerState('loading');
    try {
      const params = { page: targetPage, limit: 15 };
      if (f) params.from = f;
      if (t) params.to = t;
      if (expenseType) params.type = expenseType;
      const { data } = await api.get('/admin/expenses', { params });
      setExpenses(data.expenses || []);
      setTotalAmount(data.totalAmount ?? 0);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setLedgerState('ready');
    } catch (err) {
      setExpenses([]);
      setLedgerState('error');
      toast(err.message || 'Could not load expenses.', 'error');
    }
  }, [toast]);

  useEffect(() => {
    loadSummary(from, to);
    loadLedger(from, to, type, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyRange = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    loadSummary(from, to);
    loadLedger(from, to, type, 1);
  };
  const applyPreset = (days) => {
    const f = daysAgoIso(days - 1);
    const t = fmtDateInput(new Date());
    setFrom(f); setTo(t); setPage(1);
    loadSummary(f, t);
    loadLedger(f, t, type, 1);
  };
  const applyType = (value) => {
    setType(value); setPage(1);
    loadLedger(from, to, value, 1);
  };

  const submitExpense = async (e) => {
    e.preventDefault();
    const amount = Math.round(Number(form.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0) { toast('Enter a valid, non-negative amount.', 'error'); return; }
    setBusy(true);
    try {
      await api.post('/admin/expenses', {
        type: form.type,
        amount,
        note: form.note.trim(),
        expenseDate: form.expenseDate || undefined,
        orderNumber: form.orderNumber.trim() || undefined
      });
      toast('Expense recorded.', 'success');
      setForm(emptyForm());
      loadSummary(from, to);
      setPage(1);
      loadLedger(from, to, type, 1);
    } catch (err) {
      toast(err.message || 'Could not save the expense.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteExpense = async (expense) => {
    setDeletingId(expense.id);
    try {
      await api.delete(`/admin/expenses/${encodeURIComponent(expense.id)}`);
      toast('Expense deleted.', 'success');
      loadSummary(from, to);
      loadLedger(from, to, type, page);
    } catch (err) {
      toast(err.message || 'Could not delete the expense.', 'error');
    } finally {
      setDeletingId('');
    }
  };

  const knownCost = summary ? summary.knownCostOrders : 0;
  const unknownCost = summary ? summary.unknownCostOrders : 0;

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Finance</div><h1>Profit &amp; Expenses</h1></div>
        <div className="no-print" style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => applyPreset(7)}>7 days</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => applyPreset(30)}>30 days</button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => applyPreset(90)}>90 days</button>
        </div>
      </div>

      <form className="filters no-print" onSubmit={applyRange}>
        <div><label className="field-label" htmlFor="finFrom">From</label><input type="date" id="finFrom" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="finTo">To</label><input type="date" id="finTo" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button type="submit" className="btn btn-sm">Apply</button>
      </form>

      <div className="stats-grid">
        <div className="stat money"><small>Total sales (excl. cancelled)</small><b>{summaryState === 'ready' && summary ? money(summary.totalSales) : '—'}</b><span>non-cancelled orders in range</span></div>
        <div className="stat money"><small>Delivered revenue</small><b>{summaryState === 'ready' && summary ? money(summary.deliveredRevenue) : '—'}</b><span>collected / COD-confirmed</span></div>
        <div className={`stat money ${summary && summary.estimatedProfit < 0 ? 'bad' : 'ok'}`}><small>Estimated profit</small><b>{summaryState === 'ready' && summary ? money(summary.estimatedProfit) : '—'}</b><span>merchandise margin − tagged expenses</span></div>
        <div className={`stat money ${summary && summary.deliveredProfit < 0 ? 'bad' : 'ok'}`}><small>Delivered profit</small><b>{summaryState === 'ready' && summary ? money(summary.deliveredProfit) : '—'}</b><span>delivered orders only</span></div>
        <div className="stat money"><small>Pending COD</small><b>{summaryState === 'ready' && summary ? money(summary.pendingCodValue) : '—'}</b><span>{summary ? `${summary.pendingCodOrders} open order(s)` : ''}</span></div>
        <div className="stat money"><small>Expenses in range</small><b>{summaryState === 'ready' && summary ? money(summary.expensesInRange) : '—'}</b><span>all recorded expenses</span></div>
      </div>
      <p className="muted no-print" style={{ fontSize: 11, marginTop: -6, marginBottom: 12 }}>
        Profit covers orders with recorded supplier costs: {knownCost} of {knownCost + unknownCost} non-cancelled order(s) in range.
        {unknownCost > 0 ? ' Record supplier purchase cost on the order (or set product supplier cost) to include the rest.' : ''}
      </p>

      <div className="panel">
        <h2>Record an expense</h2>
        <form onSubmit={submitExpense}>
          <div className="two-col" style={{ gap: 12 }}>
            <div className="field"><label className="field-label" htmlFor="expType">Type</label>
              <select id="expType" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {EXPENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="field"><label className="field-label" htmlFor="expAmount">Amount (₹)</label>
              <input type="number" id="expAmount" min="0" step="0.01" required placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div className="field"><label className="field-label" htmlFor="expDate">Date</label>
              <input type="date" id="expDate" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} /></div>
            <div className="field"><label className="field-label" htmlFor="expOrder">Order ID (optional)</label>
              <input type="text" id="expOrder" placeholder="SC-261123-0001" value={form.orderNumber} onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))} /></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label className="field-label" htmlFor="expNote">Note</label>
            <input type="text" id="expNote" placeholder="Courier fee, Meesho closing charge…" maxLength={400} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? 'Saving…' : 'Add expense'}</button>
          </div>
        </form>
      </div>

      <div className="panel" style={{ paddingBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Expense ledger</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="muted" htmlFor="expFilter" style={{ fontSize: 12 }}>Type</label>
            <select id="expFilter" value={type} onChange={(e) => applyType(e.target.value)}>
              <option value="">All types</option>
              {EXPENSE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <b className="money">{money(totalAmount)}</b>
          </div>
        </div>
        <div className="table-wrap" style={{ margin: 0 }}>
          <table className="data">
            <thead><tr><th>Date</th><th>Type</th><th>Note</th><th>Order</th><th style={{ textAlign: 'right' }}>Amount</th><th className="no-print"></th></tr></thead>
            <tbody>
              {ledgerState === 'loading' && <tr><td colSpan="6" className="empty">Loading…</td></tr>}
              {ledgerState === 'error' && <tr><td colSpan="6" className="empty">Could not load expenses.</td></tr>}
              {ledgerState === 'ready' && expenses.length === 0 && <tr><td colSpan="6" className="empty">No expenses recorded in this range.</td></tr>}
              {ledgerState === 'ready' && expenses.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.expenseDate)}</td>
                  <td><span className="pill pill-other">{(EXPENSE_TYPES.find((t) => t.value === e.type) || {}).label || e.type}</span></td>
                  <td>{e.note || <span className="muted">—</span>}</td>
                  <td>{e.orderNumber ? <Link to={`/admin/orders/${e.orderNumber}`}>{e.orderNumber}</Link> : <span className="muted">store-wide</span>}</td>
                  <td style={{ textAlign: 'right' }}>{money(e.amount)}</td>
                  <td className="no-print"><button type="button" className="btn btn-danger btn-sm" disabled={deletingId === e.id} onClick={() => deleteExpense(e)}>{deletingId === e.id ? '…' : 'Delete'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          <span className="muted">{total} expense(s) · page {page} of {pages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
            <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}
