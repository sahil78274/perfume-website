import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from './chartSetup';
import api from '../api/axios';
import { money, fmtDate, fmtDateTime, pillClass } from '../utils/format';
import { useToast } from '../context/ToastContext';

function rangeFromPreset(preset, customFrom, customTo) {
  const to = new Date();
  const from = new Date();
  if (preset === '7d') from.setDate(from.getDate() - 6);
  else if (preset === '30d') from.setDate(from.getDate() - 29);
  else if (preset === '90d') from.setDate(from.getDate() - 89);
  else if (preset === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function StatCard({ label, value, extra, cls = '' }) {
  return (
    <div className={`stat ${cls}`}>
      <small>{label}</small>
      <b>{value}</b>
      {extra ? <span>{extra}</span> : null}
    </div>
  );
}

export default function Overview() {
  const { toast } = useToast();
  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  const ordersChartRef = useRef(null);
  const salesChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const chartInstances = useRef({});

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { from, to } = rangeFromPreset(preset, customFrom, customTo);
      const { data: res } = await api.get('/admin/dashboard', { params: { from, to } });
      setData(res);
      setState('ready');
    } catch (err) {
      setError(err.message || 'Could not load the dashboard.');
      setState('error');
    }
  }, [preset, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  /* Render / re-render charts whenever data changes */
  useEffect(() => {
    if (!data) return undefined;
    const series = data.series || [];
    const labels = series.map((d) => String(d.date).slice(5));
    const instances = chartInstances.current;
    Object.values(instances).forEach((c) => c && c.destroy());

    if (ordersChartRef.current) {
      instances.orders = new Chart(ordersChartRef.current, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Orders', data: series.map((d) => d.orders), backgroundColor: '#b58b52', borderRadius: 3, maxBarThickness: 26 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
    if (salesChartRef.current) {
      instances.sales = new Chart(salesChartRef.current, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Sales ₹', data: series.map((d) => d.sales), borderColor: '#b58b52', backgroundColor: 'rgba(181,139,82,.15)', fill: true, tension: 0.3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
    if (statusChartRef.current) {
      const dist = data.statusDistribution || [];
      instances.status = new Chart(statusChartRef.current, {
        type: 'doughnut',
        data: {
          labels: dist.map((s) => s.status),
          datasets: [{ data: dist.map((s) => s.count), backgroundColor: ['#e5c878', '#7ea0d8', '#b48be0', '#7cc7c0', '#6aa84f', '#1c6e3c', '#d88a8a', '#a33', '#c98b4b'] }]
        },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
      });
    }
    return () => {
      Object.values(chartInstances.current).forEach((c) => c && c.destroy());
      chartInstances.current = {};
    };
  }, [data]);

  const s = data?.stats;

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Overview</div><h1>Dashboard</h1></div>
        <form className="filters no-print" style={{ margin: 0 }} onSubmit={(e) => { e.preventDefault(); load(); }}>
          <div><label className="field-label" htmlFor="rangePreset">Range</label>
            <select id="rangePreset" value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom…</option>
            </select></div>
          {preset === 'custom' && (<>
            <div><label className="field-label" htmlFor="rangeFrom">From</label><input type="date" id="rangeFrom" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
            <div><label className="field-label" htmlFor="rangeTo">To</label><input type="date" id="rangeTo" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
          </>)}
          <button type="submit" className="btn btn-outline btn-sm">Apply</button>
        </form>
      </div>

      {state === 'loading' && <div className="stats-grid"><div className="empty" style={{ gridColumn: '1/-1' }}>Crunching the numbers…</div></div>}
      {state === 'error' && <div className="empty">Could not load the dashboard: {error}</div>}

      {state === 'ready' && s && (
        <>
          <div className="stats-grid">
            <StatCard label="Total orders" value={s.totalOrders} />
            <StatCard label="New orders" value={s.newOrders} cls="warn" />
            <StatCard label="Confirmed" value={s.confirmedOrders} />
            <StatCard label="At supplier" value={s.supplierPlacedOrders} />
            <StatCard label="Shipped" value={s.shippedOrders} />
            <StatCard label="Delivered" value={s.deliveredOrders} cls="ok" />
            <StatCard label="Cancelled" value={s.cancelledOrders} cls={s.cancelledOrders ? 'bad' : ''} />
            <StatCard label="RTO" value={s.rtoOrders} cls={s.rtoOrders ? 'bad' : ''} />
            <StatCard label="Returned" value={s.returnedOrders} cls={s.returnedOrders ? 'warn' : ''} />
            <StatCard label="Total sales" value={money(s.totalSales)} cls="money" extra="excl. cancelled/RTO/returned" />
            <StatCard label="Delivered revenue" value={money(s.deliveredRevenue)} cls="money ok" />
            <StatCard label="Pending COD" value={money(s.pendingCodValue)} cls="money warn" extra={`${s.pendingCodOrders} order(s) in pipeline`} />
            <StatCard label="Est. net profit" value={money(s.estimatedProfit)} cls="money" extra={`delivered: ${money(s.deliveredProfit)} · costs on ${s.knownCostOrders}/${s.knownCostOrders + s.unknownCostOrders}`} />
            <StatCard label="Customers" value={s.totalCustomers} />
            <StatCard label="Low stock" value={s.lowStockCount} cls={s.lowStockCount ? 'warn' : ''} extra={`${s.outOfStockCount} out of stock`} />
            <StatCard label="Expenses in range" value={money(s.expensesInRange)} cls="money" />
          </div>

          <div className="charts">
            <div className="chart-box"><h2>Orders per day · {data.range?.from} → {data.range?.to}</h2><canvas ref={ordersChartRef} aria-label="Orders per day" /></div>
            <div className="chart-box"><h2>Order status split</h2><canvas ref={statusChartRef} aria-label="Order status split" /></div>
          </div>
          <div className="charts" style={{ gridTemplateColumns: '1fr' }}>
            <div className="chart-box"><h2>Sales per day (₹, excluding cancelled/RTO/returned)</h2><canvas ref={salesChartRef} aria-label="Sales per day" /></div>
          </div>

          <div className="two-col">
            <div className="panel">
              <h2>Low-stock products <span className="muted" style={{ fontSize: 10 }}>(at or below threshold)</span></h2>
              {(data.lowStockProducts || []).length
                ? data.lowStockProducts.map((p) => (
                    <div key={p.id || p.slug} className="kv"><span><Link to="/admin/products" style={{ color: '#6b4f1d', textDecoration: 'none' }}><b>{p.name}</b></Link><br /><small className="muted">{p.sku || ''}</small></span><span className="stock-low">{p.stock} left</span></div>
                  ))
                : <div className="empty">Nothing is low on stock right now ✔</div>}
            </div>
            <div className="panel">
              <h2>Recent orders</h2>
              {(data.recentOrders || []).length
                ? data.recentOrders.map((o) => (
                    <div key={o.orderNumber} className="kv">
                      <span><Link to={`/admin/orders/${o.orderNumber}`} style={{ color: '#6b4f1d', textDecoration: 'none' }}><b>{o.orderNumber}</b></Link> {o.isGuest ? <small className="muted">guest</small> : null}<br /><small className="muted">{o.name || ''} · {fmtDate(o.createdAt)}</small></span>
                      <span style={{ textAlign: 'right' }}>{money(o.total)}<br /><span className={pillClass(o.status)}>{o.status}</span></span>
                    </div>
                  ))
                : <div className="empty">No orders yet. Share your store link to get started.</div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
