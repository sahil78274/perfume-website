'use strict';
/* SCENTORA Admin — single-page dashboard logic */
(function () {
  const API = (function () {
    async function request(path, options) {
      const opts = Object.assign({ credentials: 'same-origin', headers: {} }, options || {});
      if (opts.body && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
      }
      const res = await fetch(path, opts);
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok) {
        const err = new Error((data && data.error) || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return data;
    }
    return {
      get: (p) => request(p, { method: 'GET' }),
      post: (p, b) => request(p, { method: 'POST', body: b || {} }),
      patch: (p, b) => request(p, { method: 'PATCH', body: b || {} }),
      del: (p) => request(p, { method: 'DELETE' }),
      upload: (p, fd) => request(p, { method: 'POST', body: fd })
    };
  })();

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const escapeHtml = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const fmtDateTime = (d) => { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const fmtDateInput = (d) => { const dt = new Date(d); if (Number.isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0, 10); };

  function pillClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') return 'pill pill-delivered';
    if (['cancelled', 'rto', 'returned'].includes(s)) return 'pill pill-cancelled';
    if (s === 'new order') return 'pill pill-new';
    if (['confirmed', 'supplier order placed', 'shipped', 'out for delivery'].includes(s)) return 'pill pill-progress';
    return 'pill pill-other';
  }

  function toast(message, type) {
    const el = $('#adminToast');
    el.textContent = message;
    el.className = 'toast' + (type ? ' ' + type : '');
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 4200);
  }

  const ORDER_STATUSES = ['New Order', 'Confirmed', 'Supplier Order Placed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'RTO', 'Returned'];

  /* ================= Auth & routing ================= */
  const loginView = $('#loginView');
  const appView = $('#appView');

  function showLogin(message) {
    loginView.style.display = 'flex';
    appView.classList.remove('visible');
    const err = $('#loginError');
    if (message) { err.textContent = message; err.classList.add('show'); } else err.classList.remove('show');
  }

  function showApp(admin) {
    loginView.style.display = 'none';
    appView.classList.add('visible');
    $('#sideAdminName').textContent = admin.name;
  }

  async function bootAuth() {
    try {
      const data = await API.get('/api/admin/auth/me');
      showApp(data.admin);
      route();
    } catch {
      showLogin();
    }
  }

  $('#adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#adminLoginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    const err = $('#loginError');
    err.classList.remove('show');
    try {
      const data = await API.post('/api/admin/auth/login', {
        email: $('#adminEmail').value.trim(),
        password: $('#adminPassword').value
      });
      showApp(data.admin);
      $('#adminPassword').value = '';
      route();
    } catch (error) {
      err.textContent = error.message || 'Could not sign in.';
      err.classList.add('show');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign in securely';
    }
  });

  $('#adminLogoutBtn').addEventListener('click', async () => {
    try { await API.post('/api/admin/auth/logout'); } catch { /* cookie cleared anyway */ }
    window.location.hash = '';
    showLogin();
  });

  const VIEWS = ['dashboard', 'orders', 'order-detail', 'products', 'customers', 'expenses', 'settings'];
  function showView(name) {
    for (const v of VIEWS) {
      const el = document.getElementById('view-' + v);
      if (el) el.classList.toggle('hidden', v !== name);
    }
    $$('#sideNav a[data-nav]').forEach((a) => {
      const key = a.dataset.nav;
      a.classList.toggle('active', key === name || (name === 'order-detail' && key === 'orders'));
    });
  }

  function route() {
    const hash = window.location.hash || '#/dashboard';
    const parts = hash.replace(/^#\//, '').split('/').filter(Boolean);
    const head = parts[0] || 'dashboard';
    if (head === 'dashboard') { showView('dashboard'); loadDashboard(); }
    else if (head === 'orders' && parts[1]) { showView('order-detail'); loadOrderDetail(parts[1]); }
    else if (head === 'orders') { showView('orders'); loadOrders(); }
    else if (head === 'products') { showView('products'); loadProducts(); }
    else if (head === 'customers') { showView('customers'); loadCustomers(); }
    else if (head === 'expenses') { showView('expenses'); loadExpenses(); }
    else if (head === 'settings') { showView('settings'); loadSettings(); }
    else { showView('dashboard'); loadDashboard(); }
  }
  window.addEventListener('hashchange', route);

  /* ================= Dashboard ================= */
  let ordersChart = null, salesChart = null, statusChart = null;

  function rangeFromPreset() {
    const preset = $('#rangePreset').value;
    const to = new Date();
    const from = new Date();
    if (preset === 'today') { /* from = today */ }
    else if (preset === '7d') from.setDate(from.getDate() - 6);
    else if (preset === '30d') from.setDate(from.getDate() - 29);
    else if (preset === '90d') from.setDate(from.getDate() - 89);
    else { // custom
      const f = $('#rangeFrom').value, t = $('#rangeTo').value;
      return { from: f || undefined, to: t || undefined };
    }
    const iso = (d) => d.toISOString().slice(0, 10);
    return { from: iso(from), to: iso(to) };
  }

  $('#rangePreset').addEventListener('change', () => {
    const custom = $('#rangePreset').value === 'custom';
    $('#customFromWrap').classList.toggle('hidden', !custom);
    $('#customToWrap').classList.toggle('hidden', !custom);
  });

  $('#dashboardRangeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    loadDashboard();
  });

  function statCard(label, value, { extra = '', cls = '' } = {}) {
    return `<div class="stat ${cls}"><small>${escapeHtml(label)}</small><b>${value}</b>${extra ? `<span>${escapeHtml(extra)}</span>` : ''}</div>`;
  }

  async function loadDashboard() {
    const { from, to } = rangeFromPreset();
    const grid = $('#statsGrid');
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Crunching the numbers…</div>';
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const data = await API.get('/api/admin/dashboard?' + qs.toString());
      const s = data.stats;
      $('#chartsRangeLabel').textContent = `${data.range.from} → ${data.range.to}`;

      grid.innerHTML = [
        statCard('Total orders', s.totalOrders),
        statCard('New orders', s.newOrders, { cls: 'warn' }),
        statCard('Confirmed', s.confirmedOrders),
        statCard('At supplier', s.supplierPlacedOrders),
        statCard('Shipped', s.shippedOrders),
        statCard('Delivered', s.deliveredOrders, { cls: 'ok' }),
        statCard('Cancelled', s.cancelledOrders, { cls: s.cancelledOrders ? 'bad' : '' }),
        statCard('RTO', s.rtoOrders, { cls: s.rtoOrders ? 'bad' : '' }),
        statCard('Returned', s.returnedOrders, { cls: s.returnedOrders ? 'warn' : '' }),
        statCard('Total sales', money(s.totalSales), { cls: 'money', extra: 'excl. cancelled/RTO/returned' }),
        statCard('Delivered revenue', money(s.deliveredRevenue), { cls: 'money ok' }),
        statCard('Pending COD', money(s.pendingCodValue), { cls: 'money warn', extra: `${s.pendingCodOrders} order(s) in pipeline` }),
        statCard('Est. net profit', money(s.estimatedProfit), { cls: 'money', extra: `delivered: ${money(s.deliveredProfit)} · costs on ${s.knownCostOrders}/${s.knownCostOrders + s.unknownCostOrders}` }),
        statCard('Customers', s.totalCustomers),
        statCard('Low stock', s.lowStockCount, { cls: s.lowStockCount ? 'warn' : '', extra: `${s.outOfStockCount} out of stock` }),
        statCard('Expenses in range', money(s.expensesInRange), { cls: 'money' })
      ].join('');

      /* Charts */
      const series = data.series || [];
      const labels = series.map((d) => d.date.slice(5));
      if (window.Chart) {
        if (ordersChart) ordersChart.destroy();
        if (salesChart) salesChart.destroy();
        if (statusChart) statusChart.destroy();
        ordersChart = new Chart($('#ordersChart'), {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Orders', data: series.map((d) => d.orders), backgroundColor: '#b58b52', borderRadius: 3, maxBarThickness: 26 }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
        salesChart = new Chart($('#salesChart'), {
          type: 'line',
          data: { labels, datasets: [{ label: 'Sales ₹', data: series.map((d) => d.sales), borderColor: '#b58b52', backgroundColor: 'rgba(181,139,82,.15)', fill: true, tension: .3 }] },
          options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
        statusChart = new Chart($('#statusChart'), {
          type: 'doughnut',
          data: { labels: data.statusDistribution.map((s2) => s2.status), datasets: [{ data: data.statusDistribution.map((s2) => s2.count), backgroundColor: ['#e5c878', '#7ea0d8', '#b48be0', '#7cc7c0', '#6aa84f', '#1c6e3c', '#d88a8a', '#a33', '#c98b4b'] }] },
          options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
        });
      }

      /* Low stock */
      const lowList = $('#lowStockList');
      lowList.innerHTML = (data.lowStockProducts || []).length
        ? data.lowStockProducts.map((p) => `
          <div class="kv"><span><a href="#/products" style="color:#6b4f1d;text-decoration:none"><b>${escapeHtml(p.name)}</b></a><br><small class="muted">${escapeHtml(p.sku || '')}</small></span><span class="stock-low">${p.stock} left</span></div>`).join('')
        : '<div class="empty">Nothing is low on stock right now ✔</div>';

      /* Recent orders */
      const recent = $('#recentOrdersList');
      recent.innerHTML = (data.recentOrders || []).length
        ? data.recentOrders.map((o) => `
          <div class="kv"><span><a href="#/orders/${escapeHtml(o.orderNumber)}" style="color:#6b4f1d;text-decoration:none"><b>${escapeHtml(o.orderNumber)}</b></a> ${o.isGuest ? '<small class="muted">guest</small>' : ''}<br><small class="muted">${escapeHtml(o.name || '')} · ${fmtDate(o.createdAt)}</small></span><span style="text-align:right">${money(o.total)}<br><span class="${pillClass(o.status)}">${escapeHtml(o.status)}</span></span></div>`).join('')
        : '<div class="empty">No orders yet. Share your store link to get started.</div>';
    } catch (err) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">Could not load the dashboard: ${escapeHtml(err.message)}</div>`;
    }
  }

  /* ================= Orders list ================= */
  const ordersStateFilter = (() => {
    const sel = $('#orderStatusFilter');
    for (const s of ORDER_STATUSES) {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    }
    return sel;
  })();

  let ordersPage = 1;
  let ordersTotalPages = 1;

  function ordersQuery() {
    const qs = new URLSearchParams();
    const search = $('#orderSearch').value.trim();
    const status = ordersStateFilter.value;
    const from = $('#orderFrom').value;
    const to = $('#orderTo').value;
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return qs;
  }

  async function loadOrders(page) {
    if (page) ordersPage = page;
    const qs = ordersQuery();
    qs.set('page', String(ordersPage));
    qs.set('limit', '20');
    const tbody = $('#ordersTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
    try {
      const data = await API.get('/api/admin/orders?' + qs.toString());
      ordersTotalPages = Math.max(1, data.pages || 1);
      $('#ordersPageInfo').textContent = `${data.total} order(s) · page ${ordersPage} of ${ordersTotalPages}`;
      tbody.innerHTML = (data.orders || []).length
        ? data.orders.map((o) => `
          <tr data-order-id="${escapeHtml(o.id)}" class="order-row-link" style="cursor:pointer">
            <td><a href="#/orders/${escapeHtml(o.orderNumber)}" data-order-number="${escapeHtml(o.orderNumber)}">${escapeHtml(o.orderNumber)}</a>${o.isGuest ? '<br><small class="muted">guest</small>' : ''}</td>
            <td>${fmtDateTime(o.createdAt)}</td>
            <td>${escapeHtml(o.name)}</td>
            <td><a href="tel:${escapeHtml(o.phone)}" style="color:inherit;text-decoration:none">${escapeHtml(o.phone)}</a></td>
            <td>${o.itemsCount}</td>
            <td>${money(o.total)}</td>
            <td><span class="${pillClass(o.status)}">${escapeHtml(o.status)}</span></td>
          </tr>`).join('')
        : '<tr><td colspan="7" class="empty">No orders match those filters.</td></tr>';
      $('#ordersPrev').disabled = ordersPage <= 1;
      $('#ordersNext').disabled = ordersPage >= ordersTotalPages;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Could not load orders: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  $('#ordersFilterForm').addEventListener('submit', (e) => { e.preventDefault(); ordersPage = 1; loadOrders(); });
  $('#orderSearch').addEventListener('input', (() => {
    let t;
    return () => { clearTimeout(t); t = setTimeout(() => { ordersPage = 1; loadOrders(); }, 350); };
  })());
  $('#ordersResetBtn').addEventListener('click', () => {
    $('#orderSearch').value = ''; ordersStateFilter.value = ''; $('#orderFrom').value = ''; $('#orderTo').value = '';
    ordersPage = 1; loadOrders();
  });
  $('#ordersPrev').addEventListener('click', () => loadOrders(Math.max(1, ordersPage - 1)));
  $('#ordersNext').addEventListener('click', () => loadOrders(Math.min(ordersTotalPages, ordersPage + 1)));
  $('#exportCsvBtn').addEventListener('click', () => {
    const qs = ordersQuery();
    window.location.href = '/api/admin/orders/export.csv?' + qs.toString();
  });
  // Row click → detail (delegation); the <a> handles keyboard/middle click natively
  $('#ordersTableBody').addEventListener('click', (e) => {
    const link = e.target.closest('a[data-order-number]');
    if (link) return; // let the anchor work
    const row = e.target.closest('tr[data-order-id]');
    if (row) {
      const cell = row.querySelector('a[data-order-number]');
      if (cell) window.location.hash = '#/orders/' + cell.dataset.orderNumber;
    }
  });

  /* ================= Order detail ================= */
  const CURRENT_ORDER = { id: null };

  async function loadOrderDetail(orderParam) {
    const content = $('#orderDetailContent');
    content.innerHTML = '<div class="empty">Loading order…</div>';
    try {
      const data = await API.get('/api/admin/orders/' + encodeURIComponent(orderParam));
      const o = data.order;
      CURRENT_ORDER.id = o.orderNumber;
      $('#orderDetailTitle').textContent = 'Order ' + o.orderNumber;
      renderOrderDetail(o);
    } catch (err) {
      content.innerHTML = `<div class="empty">Could not load the order: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderOrderDetail(o) {
    const addr = o.shippingAddress || {};
    const addressLine = [addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', ');
    const itemsRows = (o.items || []).map((i) => `
      <tr><td>${escapeHtml(i.name)}${i.product ? '' : ' <span class="muted">(deleted product)</span>'}</td><td>${i.qty}</td><td>${money(i.unitPrice)}</td><td>${money(i.lineTotal)}</td><td class="muted">${i.supplierCost !== null && i.supplierCost !== undefined ? money(i.supplierCost) : '—'}</td></tr>`).join('');

    const expenseRows = (o.expenses || []).length
      ? o.expenses.map((e) => `
        <div class="kv"><span>${escapeHtml(e.type)}${e.note ? ' — <span class="muted">' + escapeHtml(e.note) + '</span>' : ''}<br><small class="muted">${fmtDate(e.expenseDate)}</small></span><span><b>${money(e.amount)}</b> <button class="linkish" data-del-expense="${escapeHtml(e.id)}" style="margin-left:8px">Remove</button></span></div>`).join('')
      : '<div class="empty">No expenses recorded for this order yet.</div>';

    const notes = (o.adminNotes || []).length
      ? o.adminNotes.map((n) => `
        <div class="kv"><span><b>${escapeHtml(n.adminName || 'Admin')}</b> · <small class="muted">${fmtDateTime(n.createdAt)}</small><br>${escapeHtml(n.text)}</span><button class="linkish" data-del-note="${escapeHtml(n.id)}">Remove</button></div>`).join('')
      : '<div class="empty">No internal notes yet.</div>';

    const timeline = (o.timeline || []).map((t) => `
      <li><b>${escapeHtml(t.status)}</b> — ${escapeHtml(t.changedByName || 'System')}<br><small>${fmtDateTime(t.at)}${t.note ? ' · ' + escapeHtml(t.note) : ''}</small></li>`).join('');

    const profit = o.profit || {};
    const profitHtml = profit.netProfit === null || profit.netProfit === undefined
      ? '<div class="empty">No supplier cost data yet — enter the supplier purchase cost (or per-product supplier costs) to see profit.</div>'
      : `
        <div class="kv"><span>Merchandise revenue</span><span>${money(o.itemsSubtotal)}</span></div>
        <div class="kv"><span>Supplier cost <small class="muted">(${profit.costSource === 'supplier' ? 'actual, from supplier entry' : profit.costSource === 'product' ? 'estimated from product costs' : 'unknown'})</small></span><span>- ${money(profit.cost)}</span></div>
        <div class="kv"><span>Gross product margin</span><span><b>${money(profit.grossMargin)}</b></span></div>
        <div class="kv"><span>Recorded expenses</span><span>- ${money(profit.expenseTotal)}</span></div>
        <div class="kv"><span>Estimated net profit</span><span><b style="font-size:16px;color:${profit.netProfit >= 0 ? 'var(--ok)' : 'var(--danger)'}">${money(profit.netProfit)}</b></span></div>
        <p class="muted" style="font-size:10.5px;margin:8px 0 0">Expense mix: shipping ${money(profit.expenses?.shipping)} · COD ${money(profit.expenses?.cod)} · ads ${money(profit.expenses?.advertising)} · RTO ${money(profit.expenses?.rto)} · other ${money(profit.expenses?.other)}. Cancelled / RTO / Returned orders are excluded from sales and revenue figures.</p>`;

    const costAdvice = o.profit && o.profit.costSource === 'none'
      ? '<p class="muted" style="font-size:10.5px">Tip: fill in the supplier purchase cost on this order (or per-product supplier costs in Products) to unlock real profit numbers.</p>'
      : '';

    $('#orderDetailContent').innerHTML = `
      <div class="order-grid">
        <div>
          <div class="panel">
            <h2>Items <span class="muted" style="font-size:11px">· ${o.itemsCount} item(s) · COD</span></h2>
            <div class="table-wrap" style="border:0"><table class="data">
              <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Line total</th><th>Supplier cost <span title="Per unit, admin-only">(per unit)</span></th></tr></thead>
              <tbody>${itemsRows}</tbody>
            </table></div>
            <div class="kv" style="margin-top:8px"><span>Items subtotal</span><span>${money(o.itemsSubtotal)}</span></div>
            <div class="kv"><span>Shipping</span><span>${o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
            <div class="kv"><span><b>Order total</b></span><span><b style="font-size:16px">${money(o.total)}</b> · Collect COD</span></div>
          </div>

          <div class="panel">
            <h2>Customer &amp; delivery</h2>
            <div class="kv"><span>Name</span><span><b>${escapeHtml(o.contact.name)}</b>${o.isGuest ? ' <small class="muted">(guest)</small>' : ' <small class="muted">(account)</small>'}</span></div>
            <div class="kv"><span>Mobile</span><span><a href="tel:${escapeHtml(o.contact.phone)}">${escapeHtml(o.contact.phone)}</a></span></div>
            <div class="kv"><span>Email</span><span>${escapeHtml(o.contact.email || '—')}</span></div>
            <div class="kv"><span>Address</span><span style="max-width:60%;text-align:right">${escapeHtml(addressLine)}<br>PIN ${escapeHtml(addr.pincode)}${addr.landmark ? ' · Landmark: ' + escapeHtml(addr.landmark) : ''}</span></div>
            ${o.notes ? `<div class="kv"><span>Customer notes</span><span>${escapeHtml(o.notes)}</span></div>` : ''}
            <div class="kv"><span>Placed</span><span>${fmtDateTime(o.createdAt)}</span></div>
            <div class="kv"><span>Payment</span><span>Cash on Delivery</span></div>
            <div class="kv"><span>Confirmation email</span><span>${escapeHtml(o.emailStatus || 'pending')}</span></div>
          </div>

          <div class="panel no-print">
            <h2>Update order status</h2>
            <form id="statusForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
              <div class="field" style="min-width:210px;margin:0"><label class="field-label" for="statusSelect">New status</label>
                <select id="statusSelect">${ORDER_STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${s === o.status ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select></div>
              <div class="field" style="flex:1;min-width:180px;margin:0"><label class="field-label" for="statusNote">Note <span class="muted" style="text-transform:none">(optional, recorded in history)</span></label><input type="text" id="statusNote" maxlength="500" placeholder="e.g. Handed to Delhivery AWB 123456"></div>
              <button type="submit" class="btn btn-gold">Update status</button>
            </form>
            <p class="muted" style="font-size:10.5px;margin:8px 0 0">Moving to Cancelled / RTO / Returned restores stock automatically (once). Moving back to an active state re-deducts stock when available. Every change is recorded with timestamp and your name.</p>
          </div>

          <div class="panel">
            <h2>Status history</h2>
            <ul class="timeline">${timeline || '<li>No history yet.</li>'}</ul>
          </div>

          <div class="panel no-print">
            <h2>Internal admin notes</h2>
            ${notes}
            <form id="noteForm" style="display:flex;gap:8px;margin-top:10px">
              <input type="text" id="noteInput" maxlength="1000" placeholder="Add an internal note (never shown to the customer)…" style="flex:1;padding:9px 10px;border:1px solid #d8d4c9;border-radius:5px" autocomplete="off">
              <button type="submit" class="btn btn-sm">Add note</button>
            </form>
          </div>
        </div>

        <div>
          <div class="panel no-print">
            <h2>Supplier fulfilment <span class="muted" style="font-size:10px">(private — admins only)</span></h2>
            <p class="muted" style="font-size:10.5px;margin-top:-6px">Your manual Meesho / supplier workflow. These details and costs are never shown to customers.</p>
            <form id="supplierForm">
              <div class="field"><label class="field-label" for="supName">Supplier name</label><input type="text" id="supName" maxlength="120" value="${escapeHtml(o.supplier?.supplierName || '')}" placeholder="e.g. Meesho — Sharma Traders"></div>
              <div class="two-col">
                <div class="field"><label class="field-label" for="supProductRef">Supplier product ref</label><input type="text" id="supProductRef" maxlength="160" value="${escapeHtml(o.supplier?.supplierProductRef || '')}" placeholder="SKU / listing ID"></div>
                <div class="field"><label class="field-label" for="supOrderId">Supplier order ID</label><input type="text" id="supOrderId" maxlength="120" value="${escapeHtml(o.supplier?.supplierOrderId || '')}" placeholder="Meesho order number"></div>
                <div class="field"><label class="field-label" for="supCost">Purchase cost (₹, total)</label><input type="number" id="supCost" min="0" step="0.01" value="${o.supplier?.supplierPurchaseCost ?? ''}" placeholder="What you pay supplier"></div>
                <div class="field"><label class="field-label" for="supDate">Supplier order date</label><input type="date" id="supDate" value="${o.supplier?.supplierOrderDate ? fmtDateInput(o.supplier.supplierOrderDate) : ''}"></div>
                <div class="field"><label class="field-label" for="supTracking">Tracking reference</label><input type="text" id="supTracking" maxlength="160" value="${escapeHtml(o.supplier?.trackingRef || '')}" placeholder="AWB / tracking no."></div>
                <div class="field"><label class="field-label" for="supStatus">Supplier status</label><select id="supStatus">${['Not placed', 'Placed', 'Dispatched', 'Delivered', 'Cancelled', 'RTO'].map((s) => `<option value="${s}" ${o.supplier?.supplierStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
              </div>
              <div class="field"><label class="field-label" for="supNotes">Fulfilment notes</label><textarea id="supNotes" maxlength="2000" placeholder="Anything about packaging, delay, replacement…">${escapeHtml(o.supplier?.fulfilmentNotes || '')}</textarea></div>
              <button type="submit" class="btn">Save supplier details</button>
            </form>
          </div>

          <div class="panel no-print">
            <h2>Expenses for this order</h2>
            ${expenseRows}
            <form id="orderExpenseForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:end">
              <div class="field" style="width:130px;margin:0"><label class="field-label" for="oeType">Type</label><select id="oeType"><option value="shipping">Shipping</option><option value="cod">COD charge</option><option value="advertising">Advertising</option><option value="rto">RTO / return</option><option value="other">Other</option></select></div>
              <div class="field" style="width:110px;margin:0"><label class="field-label" for="oeAmount">Amount ₹</label><input type="number" id="oeAmount" min="0" step="0.01" required placeholder="0.00"></div>
              <div class="field" style="flex:1;min-width:120px;margin:0"><label class="field-label" for="oeNote">Note</label><input type="text" id="oeNote" maxlength="400" placeholder="Optional"></div>
              <button type="submit" class="btn btn-sm">Add</button>
            </form>
          </div>

          <div class="panel">
            <h2>Profit breakdown</h2>
            ${profitHtml}
            ${costAdvice}
          </div>
        </div>
      </div>`;

    /* --- Wire interactions --- */
    $('#statusForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = $('#statusSelect').value;
      const note = $('#statusNote').value.trim();
      try {
        const data2 = await API.patch(`/api/admin/orders/${encodeURIComponent(o.orderNumber)}/status`, { status, note });
        toast('Order marked as ' + status, 'success');
        renderOrderDetail(data2.order);
      } catch (err) {
        toast(err.message || 'Could not update status.', 'error');
      }
    });

    $('#supplierForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        supplierName: $('#supName').value.trim(),
        supplierProductRef: $('#supProductRef').value.trim(),
        supplierOrderId: $('#supOrderId').value.trim(),
        supplierPurchaseCost: $('#supCost').value === '' ? null : Number($('#supCost').value),
        supplierOrderDate: $('#supDate').value || null,
        trackingRef: $('#supTracking').value.trim(),
        fulfilmentNotes: $('#supNotes').value.trim(),
        supplierStatus: $('#supStatus').value
      };
      try {
        await API.patch(`/api/admin/orders/${encodeURIComponent(o.orderNumber)}/supplier`, payload);
        toast('Supplier details saved.', 'success');
        loadOrderDetail(o.orderNumber);
      } catch (err) {
        toast(err.message || 'Could not save supplier details.', 'error');
      }
    });

    $('#noteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#noteInput');
      const text = input.value.trim();
      if (text.length < 2) { toast('Note is too short.', 'error'); return; }
      try {
        await API.post(`/api/admin/orders/${encodeURIComponent(o.orderNumber)}/notes`, { text });
        input.value = '';
        loadOrderDetail(o.orderNumber);
      } catch (err) {
        toast(err.message || 'Could not add the note.', 'error');
      }
    });

    $('#orderExpenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = Number($('#oeAmount').value);
      try {
        await API.post(`/api/admin/orders/${encodeURIComponent(o.orderNumber)}/expenses`, {
          type: $('#oeType').value,
          amount,
          note: $('#oeNote').value.trim()
        });
        toast('Expense added.', 'success');
        loadOrderDetail(o.orderNumber);
      } catch (err) {
        toast(err.message || 'Could not add expense.', 'error');
      }
    });
  }

  $('#printOrderBtn').addEventListener('click', () => window.print());

  /* Delegated handler for remove buttons inside the (re-rendered) order detail */
  $('#orderDetailContent').addEventListener('click', async (e) => {
    const delExpense = e.target.closest('[data-del-expense]')?.dataset.delExpense;
    const delNote = e.target.closest('[data-del-note]')?.dataset.delNote;
    const orderNumber = CURRENT_ORDER.id;
    if (!orderNumber) return;
    try {
      if (delExpense) {
        await API.del('/api/admin/expenses/' + encodeURIComponent(delExpense));
        toast('Expense removed.');
        loadOrderDetail(orderNumber);
      } else if (delNote) {
        await API.del(`/api/admin/orders/${encodeURIComponent(orderNumber)}/notes/${encodeURIComponent(delNote)}`);
        toast('Note removed.');
        loadOrderDetail(orderNumber);
      }
    } catch (err) {
      toast(err.message || 'Could not remove.', 'error');
    }
  });

  /* ================= Products ================= */
  let productsPage = 1;
  let productsTotalPages = 1;
  let pfImages = []; // [{id, url, publicId, isNew?}] — current images for the open product

  async function loadCategoriesForSelect() {
    const sel = $('#pfCategory');
    const data = await API.get('/api/admin/categories');
    sel.innerHTML = (data.categories || []).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.isActive ? '' : ' (inactive)'}</option>`).join('');
  }

  function productCardHtml(p) {
    const cover = p.images && p.images[0] ? p.images[0].url : '/images/favicon.svg';
    const stockCls = p.stock === 0 ? 'stock-out' : p.stock <= 5 ? 'stock-low' : 'stock-ok';
    return `
      <div class="prod-card" data-product-id="${escapeHtml(p.id)}">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.name)}" loading="lazy">
        <div class="body">
          <b>${escapeHtml(p.name)}</b>
          <div class="meta"><span class="status-dot ${p.status === 'active' ? 'dot-active' : 'dot-inactive'}"></span>${escapeHtml(p.status)} · SKU ${escapeHtml(p.sku)} ${p.featured ? '· ★ Featured' : ''}</div>
          <div class="price-row"><strong>${money(p.price)}</strong><span class="${stockCls}">${p.stock} in stock</span></div>
          <div class="meta">Cost: ${p.supplierCost !== null && p.supplierCost !== undefined ? money(p.supplierCost) : 'not set'} ${p.compareAtPrice ? '· MRP ' + money(p.compareAtPrice) : ''}</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn btn-outline btn-sm" data-edit-product="${escapeHtml(p.id)}">Edit</button>
            <button class="btn btn-sm ${p.status === 'active' ? 'btn-outline' : 'btn-gold'}" data-toggle-status="${escapeHtml(p.id)}" data-current="${escapeHtml(p.status)}">${p.status === 'active' ? 'Archive' : 'Reactivate'}</button>
          </div>
        </div>
      </div>`;
  }

  async function loadProducts(page) {
    if (page) productsPage = page;
    const qs = new URLSearchParams();
    const search = $('#productSearch').value.trim();
    const status = $('#productStatusFilter').value;
    const lowStock = $('#productLowStock').value;
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    if (lowStock) qs.set('lowStock', lowStock);
    qs.set('page', String(productsPage));
    qs.set('limit', '12');
    const grid = $('#productsGrid');
    grid.innerHTML = '<div class="empty">Loading products…</div>';
    try {
      const data = await API.get('/api/admin/products?' + qs.toString());
      productsTotalPages = Math.max(1, data.pages || 1);
      $('#productsPageInfo').textContent = `${data.total} product(s) · page ${productsPage} of ${productsTotalPages}`;
      grid.innerHTML = (data.products || []).length
        ? data.products.map(productCardHtml).join('')
        : '<div class="empty">No products found.</div>';
      $('#productsPrev').disabled = productsPage <= 1;
      $('#productsNext').disabled = productsPage >= productsTotalPages;
    } catch (err) {
      grid.innerHTML = `<div class="empty">Could not load products: ${escapeHtml(err.message)}</div>`;
    }
  }

  $('#productsFilterForm').addEventListener('submit', (e) => { e.preventDefault(); productsPage = 1; loadProducts(); });
  $('#productSearch').addEventListener('input', (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => { productsPage = 1; loadProducts(); }, 350); }; })());
  $('#productsPrev').addEventListener('click', () => loadProducts(Math.max(1, productsPage - 1)));
  $('#productsNext').addEventListener('click', () => loadProducts(Math.min(productsTotalPages, productsPage + 1)));

  /* Modal open/close */
  const productModal = $('#productModal');
  function closeProductModal() { productModal.classList.remove('open'); }
  $('#pfCancelBtn').addEventListener('click', closeProductModal);
  productModal.addEventListener('click', (e) => { if (e.target === productModal) closeProductModal(); });

  function renderPfImages() {
    $('#pfImages').innerHTML = pfImages.map((img) => `
      <div class="img-thumb"><img src="${escapeHtml(img.url)}" alt=""><button type="button" data-remove-image="${escapeHtml(img.id || '')}" title="Remove photo">✕</button></div>`).join('');
  }

  async function openProductEditor(productId) {
    $('#productForm').reset();
    $('#pfId').value = productId || '';
    $('#pfImages').innerHTML = '';
    $('#pfImageFiles').value = '';
    $('#productModalTitle').textContent = productId ? 'Edit product' : 'Add product';
    await loadCategoriesForSelect();
    if (productId) {
      try {
        const data = await API.get('/api/admin/products/' + encodeURIComponent(productId));
        const p = data.product;
        $('#pfName').value = p.name;
        $('#pfSku').value = p.sku;
        $('#pfCategory').value = (p.category && p.category.id) || p.category || '';
        $('#pfPrice').value = p.price;
        $('#pfCompareAt').value = p.compareAtPrice ?? '';
        $('#pfSupplierCost').value = p.supplierCost ?? '';
        $('#pfStock').value = p.stock;
        $('#pfLowStock').value = p.lowStockThreshold ?? '';
        $('#pfStatus').value = p.status;
        $('#pfFeatured').checked = Boolean(p.featured);
        $('#pfShort').value = p.shortDescription || '';
        $('#pfDescription').value = p.description || '';
        $('#pfTags').value = (p.tags || []).join(', ');
        pfImages = p.images || [];
        renderPfImages();
      } catch (err) {
        toast(err.message || 'Could not load the product.', 'error');
        return;
      }
    } else {
      pfImages = [];
      renderPfImages();
    }
    productModal.classList.add('open');
  }

  $('#addProductBtn').addEventListener('click', () => openProductEditor(null));
  $('#productsGrid').addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit-product]')?.dataset.editProduct;
    const toggleBtn = e.target.closest('[data-toggle-status]');
    if (editId) { openProductEditor(editId); return; }
    if (toggleBtn) {
      const id = toggleBtn.dataset.toggleStatus;
      const makeInactive = toggleBtn.dataset.current === 'active';
      if (makeInactive && !window.confirm('Archive this product? It will disappear from the storefront (orders keep their history).')) return;
      try {
        if (makeInactive) {
          await API.del('/api/admin/products/' + encodeURIComponent(id));
          toast('Product archived (set to Inactive).', 'success');
        } else {
          await API.patch('/api/admin/products/' + encodeURIComponent(id), { status: 'active' });
          toast('Product reactivated.', 'success');
        }
        loadProducts();
      } catch (err) {
        toast(err.message || 'Could not update the product.', 'error');
      }
    }
  });

  /* Save product */
  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#pfSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    const id = $('#pfId').value;
    const payload = {
      name: $('#pfName').value.trim(),
      sku: $('#pfSku').value.trim().toUpperCase(),
      category: $('#pfCategory').value,
      price: Number($('#pfPrice').value),
      compareAtPrice: $('#pfCompareAt').value === '' ? null : Number($('#pfCompareAt').value),
      supplierCost: $('#pfSupplierCost').value === '' ? null : Number($('#pfSupplierCost').value),
      stock: Math.floor(Number($('#pfStock').value)),
      lowStockThreshold: $('#pfLowStock').value === '' ? null : Math.floor(Number($('#pfLowStock').value)),
      status: $('#pfStatus').value,
      featured: $('#pfFeatured').checked,
      shortDescription: $('#pfShort').value.trim(),
      description: $('#pfDescription').value.trim(),
      tags: $('#pfTags').value.split(',').map((t) => t.trim()).filter(Boolean)
    };
    try {
      if (id) await API.patch('/api/admin/products/' + encodeURIComponent(id), payload);
      else {
        const created = await API.post('/api/admin/products', payload);
        $('#pfId').value = created.product.id;
        $('#productModalTitle').textContent = 'Edit product (photos)';
      }
      toast('Product saved.', 'success');
      loadProducts();
      if (id) closeProductModal();
    } catch (err) {
      toast(err.message || 'Could not save the product.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save product';
    }
  });

  /* Image upload (Cloudinary via server) */
  $('#pfUploadBtn').addEventListener('click', async () => {
    const id = $('#pfId').value;
    if (!id) { toast('Save the product first, then upload photos.', 'error'); return; }
    const files = $('#pfImageFiles').files;
    if (!files.length) { toast('Choose one or more photos first.', 'error'); return; }
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    const btn = $('#pfUploadBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const data = await API.upload(`/api/admin/products/${encodeURIComponent(id)}/images`, fd);
      pfImages = data.product.images || [];
      renderPfImages();
      $('#pfImageFiles').value = '';
      toast('Photos uploaded.', 'success');
      loadProducts();
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Upload selected photos';
    }
  });

  $('#pfImages').addEventListener('click', async (e) => {
    const imageId = e.target.closest('[data-remove-image]')?.dataset.removeImage;
    if (!imageId) return;
    const id = $('#pfId').value;
    if (!id) return;
    if (!window.confirm('Remove this photo?')) return;
    try {
      const data = await API.del(`/api/admin/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`);
      pfImages = data.product.images || [];
      renderPfImages();
      loadProducts();
    } catch (err) {
      toast(err.message || 'Could not remove the photo.', 'error');
    }
  });

  /* ================= Customers ================= */
  let customersPage = 1;
  let customersTotalPages = 1;

  async function loadCustomers(page) {
    if (page) customersPage = page;
    const qs = new URLSearchParams();
    const search = $('#customerSearch').value.trim();
    if (search) qs.set('search', search);
    qs.set('page', String(customersPage));
    qs.set('limit', '20');
    const tbody = $('#customersTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
    try {
      const data = await API.get('/api/admin/customers?' + qs.toString());
      customersTotalPages = Math.max(1, data.pages || 1);
      $('#customersPageInfo').textContent = `${data.total} customer(s) · page ${customersPage} of ${customersTotalPages}`;
      tbody.innerHTML = (data.customers || []).length
        ? data.customers.map((c) => `
          <tr data-customer-id="${escapeHtml(c.id)}" style="cursor:pointer">
            <td><b>${escapeHtml(c.name)}</b><br><small class="muted">${escapeHtml(c.email || 'no email')}</small></td>
            <td>${escapeHtml(c.phone)}</td>
            <td>${c.totalOrders}</td>
            <td>${c.deliveredOrders}</td>
            <td>${c.cancelledRtoOrders}</td>
            <td>${money(c.deliveredSpend)}</td>
            <td>${c.lastOrderAt ? fmtDate(c.lastOrderAt) : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="7" class="empty">No customers found.</td></tr>';
      $('#customersPrev').disabled = customersPage <= 1;
      $('#customersNext').disabled = customersPage >= customersTotalPages;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Could not load customers: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  $('#customersFilterForm').addEventListener('submit', (e) => { e.preventDefault(); customersPage = 1; loadCustomers(); });
  $('#customersPrev').addEventListener('click', () => loadCustomers(Math.max(1, customersPage - 1)));
  $('#customersNext').addEventListener('click', () => loadCustomers(Math.min(customersTotalPages, customersPage + 1)));

  $('#customersTableBody').addEventListener('click', async (e) => {
    const row = e.target.closest('tr[data-customer-id]');
    if (!row) return;
    const panel = $('#customerDetailPanel');
    panel.classList.remove('hidden');
    panel.innerHTML = '<div class="empty">Loading customer…</div>';
    try {
      const data = await API.get('/api/admin/customers/' + encodeURIComponent(row.dataset.customerId));
      const c = data.customer;
      const orders = (c.orders || []).map((o) => `
        <div class="kv"><span><a href="#/orders/${escapeHtml(o.orderNumber)}"><b>${escapeHtml(o.orderNumber)}</b></a><br><small class="muted">${fmtDate(o.createdAt)} · ${o.itemsCount} item(s) · COD</small></span><span style="text-align:right">${money(o.total)}<br><span class="${pillClass(o.status)}">${escapeHtml(o.status)}</span></span></div>`).join('') || '<div class="empty">No orders yet.</div>';
      const addresses = (c.addresses || []).map((a) => `
        <div class="kv"><span><b>${escapeHtml(a.label)}</b>${a.isDefault ? ' (default)' : ''}<br><small class="muted">${escapeHtml(a.fullName)} · ${escapeHtml(a.phone)}</small></span><span style="max-width:55%;text-align:right">${escapeHtml([a.houseAndStreet, a.area, a.city, a.state].filter(Boolean).join(', '))} · PIN ${escapeHtml(a.pincode)}</span></div>`).join('') || '<div class="empty">No saved addresses.</div>';
      panel.innerHTML = `
        <div class="panel-title"><h2 style="margin:0">${escapeHtml(c.name)}</h2><button class="btn btn-outline btn-sm" id="closeCustomerDetail">Close</button></div>
        <div class="two-col">
          <div>
            <div class="kv"><span>Mobile</span><span><a href="tel:${escapeHtml(c.phone)}">${escapeHtml(c.phone)}</a></span></div>
            <div class="kv"><span>Email</span><span>${escapeHtml(c.email || '—')}</span></div>
            <div class="kv"><span>Registered</span><span>${fmtDateTime(c.registeredAt)}</span></div>
            <div class="kv"><span>Last login</span><span>${c.lastLoginAt ? fmtDateTime(c.lastLoginAt) : '—'}</span></div>
            <div class="kv"><span>Promo consent</span><span>${c.promoConsent ? 'Yes — opted in' : 'No'}</span></div>
          </div>
          <div>
            <div class="kv"><span>Total orders</span><span><b>${c.stats.totalOrders}</b></span></div>
            <div class="kv"><span>Delivered</span><span>${c.stats.deliveredOrders}</span></div>
            <div class="kv"><span>Cancelled / RTO</span><span>${c.stats.cancelledRtoOrders}</span></div>
            <div class="kv"><span>Delivered spend</span><span><b>${money(c.stats.deliveredSpend)}</b></span></div>
          </div>
        </div>
        <h2 style="margin-top:14px">Saved addresses</h2>${addresses}
        <h2 style="margin-top:14px">Recent orders</h2>${orders}`;
      $('#closeCustomerDetail').addEventListener('click', () => panel.classList.add('hidden'));
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      panel.innerHTML = `<div class="empty">Could not load the customer: ${escapeHtml(err.message)}</div>`;
    }
  });

  /* ================= Expenses ================= */
  async function loadExpenses() {
    const tbody = $('#expensesTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading…</td></tr>';
    try {
      const data = await API.get('/api/admin/expenses?limit=50');
      $('#expensesTotalBadge').textContent = `Total recorded: ${money(data.totalAmount || 0)}`;
      tbody.innerHTML = (data.expenses || []).length
        ? data.expenses.map((e) => `
          <tr>
            <td>${fmtDate(e.expenseDate)}</td>
            <td>${escapeHtml(e.type)}</td>
            <td>${e.orderNumber ? `<a href="#/orders/${escapeHtml(e.orderNumber)}">${escapeHtml(e.orderNumber)}</a>` : '<span class="muted">store-wide</span>'}</td>
            <td>${escapeHtml(e.note || '')}</td>
            <td style="text-align:right">${money(e.amount)}</td>
            <td><button class="linkish" data-delete-expense="${escapeHtml(e.id)}" style="color:var(--danger)">Delete</button></td>
          </tr>`).join('')
        : '<tr><td colspan="6" class="empty">No expenses recorded yet.</td></tr>';
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">Could not load expenses: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  $('#expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: $('#expType').value,
      amount: Number($('#expAmount').value),
      orderNumber: $('#expOrder').value.trim() || undefined,
      note: $('#expNote').value.trim(),
      expenseDate: $('#expDate').value || undefined
    };
    try {
      await API.post('/api/admin/expenses', payload);
      toast('Expense recorded.', 'success');
      $('#expAmount').value = ''; $('#expNote').value = ''; $('#expOrder').value = '';
      loadExpenses();
    } catch (err) {
      toast(err.message || 'Could not add the expense.', 'error');
    }
  });

  $('#expensesTableBody').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-delete-expense]')?.dataset.deleteExpense;
    if (!id) return;
    if (!window.confirm('Delete this expense?')) return;
    try {
      await API.del('/api/admin/expenses/' + encodeURIComponent(id));
      toast('Expense deleted.');
      loadExpenses();
    } catch (err) {
      toast(err.message || 'Could not delete.', 'error');
    }
  });

  /* ================= Settings ================= */
  async function loadSettings() {
    try {
      const data = await API.get('/api/admin/settings');
      const s = data.settings;
      $('#setStoreName').value = s.storeName || '';
      $('#setSupportEmail').value = s.supportEmail || '';
      $('#setSupportPhone').value = s.supportPhone || '';
      $('#setShippingCharge').value = s.shippingCharge ?? 0;
      $('#setFreeShipping').value = s.freeShippingAbove ?? '';
      $('#setLowStock').value = s.lowStockThreshold ?? 5;
      $('#setCodMessage').value = s.codMessage || '';
      $('#setPromoText').value = s.promoConsentText || '';
      $('#setConfirmation').value = s.confirmationNote || '';
    } catch (err) {
      toast(err.message || 'Could not load settings.', 'error');
    }
  }

  $('#settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      storeName: $('#setStoreName').value.trim(),
      supportEmail: $('#setSupportEmail').value.trim(),
      supportPhone: $('#setSupportPhone').value.trim(),
      shippingCharge: Number($('#setShippingCharge').value),
      freeShippingAbove: $('#setFreeShipping').value === '' ? null : Number($('#setFreeShipping').value),
      lowStockThreshold: Number($('#setLowStock').value),
      codMessage: $('#setCodMessage').value.trim(),
      promoConsentText: $('#setPromoText').value.trim(),
      confirmationNote: $('#setConfirmation').value.trim()
    };
    try {
      await API.patch('/api/admin/settings', payload);
      toast('Settings saved.', 'success');
    } catch (err) {
      toast(err.message || 'Could not save settings.', 'error');
    }
  });

  $('#passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await API.post('/api/admin/auth/change-password', {
        currentPassword: $('#curPassword').value,
        newPassword: $('#newPassword').value
      });
      toast('Password updated.', 'success');
      e.target.reset();
    } catch (err) {
      toast(err.message || 'Could not update password.', 'error');
    }
  });

  /* ================= Boot ================= */
  bootAuth();
})();
