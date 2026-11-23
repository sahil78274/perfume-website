'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const { money, escapeHtml, badgeFor, toast } = window.Scentora;
  const API = window.ScentoraAPI;
  const next = new URLSearchParams(window.location.search).get('next') || '/account.html';

  const authView = document.getElementById('authView');
  const dashView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('showLoginBtn');
  const registerBtn = document.getElementById('showRegisterBtn');

  const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
  const addrState = document.getElementById('addrState');
  for (const s of STATES) { const o = document.createElement('option'); o.value = s; o.textContent = s; addrState.appendChild(o); }

  /* Public store settings (promo consent copy) */
  try {
    const settings = await API.get('/api/settings');
    const consentEl = document.getElementById('promoConsentText');
    if (consentEl && settings.promoConsentText) consentEl.textContent = settings.promoConsentText;
  } catch { /* keep default copy */ }

  function showAuth(mode) {
    authView.classList.remove('hidden');
    dashView.classList.add('hidden');
    loginForm.classList.toggle('hidden', mode !== 'login');
    registerForm.classList.toggle('hidden', mode !== 'register');
    loginBtn.className = mode === 'login' ? 'btn btn-sm' : 'btn btn-outline btn-sm';
    registerBtn.className = mode === 'register' ? 'btn btn-sm' : 'btn btn-outline btn-sm';
  }

  function showDashboard() {
    authView.classList.add('hidden');
    dashView.classList.remove('hidden');
    refreshAll();
  }

  async function refreshAll() {
    try {
      const me = await API.get('/api/auth/me');
      window.__scentoraCustomer = true;
      document.getElementById('dashName').textContent = me.user.name;
      document.getElementById('profileName').value = me.user.name;
      document.getElementById('profilePhone').value = me.user.phone;
      document.getElementById('profileEmail').value = me.user.email || '';
      document.getElementById('profilePromo').checked = Boolean(me.user.promoConsent);
      loadOrders();
      loadAddresses();
    } catch {
      window.__scentoraCustomer = false;
      showAuth('login');
    }
  }

  /* ---------- Auth ---------- */
  loginBtn.addEventListener('click', () => showAuth('login'));
  registerBtn.addEventListener('click', () => showAuth('register'));
  document.querySelectorAll('[data-show-register]').forEach((el) => el.addEventListener('click', () => showAuth('register')));
  document.querySelectorAll('[data-show-login]').forEach((el) => el.addEventListener('click', () => showAuth('login')));

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginSubmit');
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      await API.post('/api/auth/login', { phone: loginForm.elements.phone.value.trim(), password: loginForm.elements.password.value });
      toast('Welcome back!', 'success');
      const target = next && next.startsWith('/') ? next : '/account.html';
      if (target !== '/account.html') { window.location.href = target; return; }
      showDashboard();
    } catch (err) {
      toast(err.message || 'Could not log in.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Log in';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('registerSubmit');
    btn.disabled = true; btn.textContent = 'Creating your account…';
    try {
      await API.post('/api/auth/register', {
        name: registerForm.elements.name.value.trim(),
        phone: registerForm.elements.phone.value.trim(),
        email: registerForm.elements.email.value.trim(),
        password: registerForm.elements.password.value,
        promoConsent: registerForm.elements.promoConsent.checked
      });
      toast('Account created — welcome to SCENTORA!', 'success');
      const target = next && next.startsWith('/') ? next : '/account.html';
      if (target !== '/account.html') { window.location.href = target; return; }
      showDashboard();
    } catch (err) {
      toast(err.message || 'Could not create your account.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Create account';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await API.post('/api/auth/logout');
    window.__scentoraCustomer = false;
    toast('Logged out. See you soon!');
    showAuth('login');
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.account-tabs [data-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.account-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b === tabBtn));
      document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.add('hidden'));
      document.getElementById('tab-' + tabBtn.dataset.tab).classList.remove('hidden');
    });
  });

  /* ---------- Orders ---------- */
  const ordersState = document.getElementById('ordersState');
  const ordersList = document.getElementById('ordersList');
  const orderDetail = document.getElementById('orderDetail');

  async function loadOrders() {
    try {
      const data = await API.get('/api/account/orders');
      const orders = data.orders || [];
      if (!orders.length) {
        ordersState.innerHTML = 'No orders yet. <a href="/shop.html">Browse the collection</a>';
        ordersList.innerHTML = '';
        return;
      }
      ordersState.classList.add('hidden');
      ordersList.innerHTML = orders.map((o) => `
        <button class="order-row" data-order="${escapeHtml(o.orderNumber)}">
          <span>
            <strong>${escapeHtml(o.orderNumber)}</strong><br>
            <small style="color:var(--muted)">${new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${o.itemsCount} item(s) · ${(o.items[0] && o.items[0].name) ? escapeHtml(o.items[0].name) + (o.itemsCount > 1 ? ' +' + (o.itemsCount - 1) : '') : ''}</small>
          </span>
          <span style="text-align:right">
            <strong>${money(o.total)}</strong><br>
            <span class="${badgeFor(o.status)}">${escapeHtml(o.status)}</span>
          </span>
        </button>`).join('');
    } catch (err) {
      ordersState.textContent = err.message || 'Could not load your orders.';
      ordersState.classList.remove('hidden');
    }
  }

  ordersList.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-order]');
    if (!row) return;
    orderDetail.classList.remove('hidden');
    orderDetail.innerHTML = '<div class="state-box">Loading order…</div>';
    try {
      const data = await API.get('/api/account/orders/' + encodeURIComponent(row.dataset.order));
      const o = data.order;
      const canCancel = ['New Order', 'Confirmed'].includes(o.status);
      const items = (o.items || []).map((i) => `
        <div class="osi-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.lineTotal)}</span></div>`).join('');
      const addr = o.shippingAddress || {};
      orderDetail.innerHTML = `
        <div class="panel-title"><h3 style="margin:0">Order ${escapeHtml(o.orderNumber)}</h3><span class="${badgeFor(o.status)}">${escapeHtml(o.status)}</span></div>
        <div class="osi-row" style="border-bottom:1px solid var(--line)"><span>Placed</span><span>${new Date(o.createdAt).toLocaleString('en-IN')}</span></div>
        <div class="osi-row" style="border-bottom:1px solid var(--line)"><span>Payment</span><span>Cash on Delivery (COD)</span></div>
        ${items}
        <div class="summary-row"><span>Subtotal</span><span>${money(o.itemsSubtotal)}</span></div>
        <div class="summary-row"><span>Shipping</span><span>${o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${money(o.total)}</span></div>
        <p style="font-size:12.5px;color:#555;margin-top:10px"><strong>Deliver to:</strong> ${escapeHtml([addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', '))} · PIN ${escapeHtml(addr.pincode)}</p>
        <h4 style="margin:14px 0 6px">Status history</h4>
        <ul class="timeline">${(o.timeline || []).map((t) => `<li class="done"><strong>${escapeHtml(t.status)}</strong><br><small>${new Date(t.at).toLocaleString('en-IN')}${t.note ? ' · ' + escapeHtml(t.note) : ''}</small></li>`).join('')}</ul>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          ${canCancel ? `<button class="btn btn-danger btn-sm" id="cancelOrderBtn">Cancel this order</button>` : ''}
          <a class="btn btn-outline btn-sm" href="/track-order.html">Open tracking view</a>
        </div>`;
      const cancelBtn = document.getElementById('cancelOrderBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
          if (!window.confirm('Cancel this order? This cannot be undone.')) return;
          cancelBtn.disabled = true;
          try {
            await API.post(`/api/account/orders/${encodeURIComponent(o.orderNumber)}/cancel`, {});
            toast('Order cancelled. Stock has been returned.', 'success');
            orderDetail.classList.add('hidden');
            loadOrders();
          } catch (err) {
            toast(err.message || 'Could not cancel the order.', 'error');
            cancelBtn.disabled = false;
          }
        });
      }
    } catch (err) {
      orderDetail.innerHTML = `<div class="state-box error">${escapeHtml(err.message || 'Could not load the order.')}</div>`;
    }
  });

  /* ---------- Addresses ---------- */
  const addressesState = document.getElementById('addressesState');
  const addressesList = document.getElementById('addressesList');
  const addressForm = document.getElementById('addressForm');
  const addressFormTitle = document.getElementById('addressFormTitle');
  let addresses = [];

  async function loadAddresses() {
    try {
      const data = await API.get('/api/account/addresses');
      addresses = data.addresses || [];
      addressesState.classList.add('hidden');
      addressesList.innerHTML = addresses.length
        ? addresses.map((a) => `
          <div class="address-card" data-id="${escapeHtml(a.id)}">
            ${a.isDefault ? '<span class="default-tag">Default</span>' : ''}
            <strong>${escapeHtml(a.label || 'Address')}</strong> — ${escapeHtml(a.fullName)} · ${escapeHtml(a.phone)}<br>
            <span style="font-size:12.5px;color:#555">${escapeHtml([a.houseAndStreet, a.area, a.city, a.state].filter(Boolean).join(', '))} · PIN ${escapeHtml(a.pincode)}${a.landmark ? ' · Near ' + escapeHtml(a.landmark) : ''}</span>
            <div style="display:flex;gap:12px;margin-top:8px">
              <button class="linkish" data-act="edit">Edit</button>
              ${a.isDefault ? '' : '<button class="linkish" data-act="default">Make default</button>'}
              <button class="linkish" data-act="delete" style="color:var(--danger)">Delete</button>
            </div>
          </div>`).join('')
        : '<div class="state-box">No saved addresses yet.</div>';
    } catch (err) {
      addressesState.textContent = err.message || 'Could not load addresses.';
      addressesState.classList.remove('hidden');
    }
  }

  function resetAddressForm() {
    addressForm.reset();
    document.getElementById('addressId').value = '';
    addressFormTitle.textContent = 'Add a new address';
  }

  document.getElementById('addAddressBtn').addEventListener('click', () => {
    resetAddressForm();
    addressForm.classList.toggle('hidden');
  });
  document.getElementById('addressCancelBtn').addEventListener('click', () => {
    addressForm.classList.add('hidden');
    resetAddressForm();
  });

  addressesList.addEventListener('click', async (e) => {
    const card = e.target.closest('.address-card');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!card || !act) return;
    const id = card.dataset.id;
    if (act === 'edit') {
      const a = addresses.find((x) => x.id === id);
      if (!a) return;
      document.getElementById('addressId').value = a.id;
      document.getElementById('addrLabel').value = a.label || '';
      document.getElementById('addrName').value = a.fullName;
      document.getElementById('addrPhone').value = a.phone;
      document.getElementById('addrHouse').value = a.houseAndStreet;
      document.getElementById('addrArea').value = a.area;
      document.getElementById('addrCity').value = a.city;
      addrState.value = a.state;
      document.getElementById('addrPin').value = a.pincode;
      document.getElementById('addrLandmark').value = a.landmark || '';
      document.getElementById('addrDefault').checked = Boolean(a.isDefault);
      addressFormTitle.textContent = 'Edit address';
      addressForm.classList.remove('hidden');
      addressForm.scrollIntoView({ behavior: 'smooth' });
    } else if (act === 'default') {
      try { await API.post(`/api/account/addresses/${id}/default`, {}); toast('Default address updated.', 'success'); loadAddresses(); }
      catch (err) { toast(err.message || 'Could not update.', 'error'); }
    } else if (act === 'delete') {
      if (!window.confirm('Delete this address?')) return;
      try { await API.del(`/api/account/addresses/${id}`); toast('Address deleted.'); loadAddresses(); }
      catch (err) { toast(err.message || 'Could not delete.', 'error'); }
    }
  });

  addressForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('addressSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    const payload = {
      label: document.getElementById('addrLabel').value.trim() || 'Home',
      fullName: document.getElementById('addrName').value.trim(),
      phone: document.getElementById('addrPhone').value.trim(),
      houseAndStreet: document.getElementById('addrHouse').value.trim(),
      area: document.getElementById('addrArea').value.trim(),
      city: document.getElementById('addrCity').value.trim(),
      state: addrState.value,
      pincode: document.getElementById('addrPin').value.trim(),
      landmark: document.getElementById('addrLandmark').value.trim(),
      isDefault: document.getElementById('addrDefault').checked
    };
    const id = document.getElementById('addressId').value;
    try {
      if (id) await API.patch(`/api/account/addresses/${id}`, payload);
      else await API.post('/api/account/addresses', payload);
      toast('Address saved.', 'success');
      addressForm.classList.add('hidden');
      resetAddressForm();
      loadAddresses();
    } catch (err) {
      toast(err.message || 'Could not save the address.', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save address';
    }
  });

  /* ---------- Profile & password ---------- */
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('profileSaveBtn');
    btn.disabled = true;
    try {
      await API.patch('/api/auth/me', {
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim(),
        promoConsent: document.getElementById('profilePromo').checked
      });
      toast('Profile saved.', 'success');
    } catch (err) {
      toast(err.message || 'Could not save your profile.', 'error');
    } finally { btn.disabled = false; }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('passwordSaveBtn');
    btn.disabled = true;
    try {
      await API.post('/api/auth/change-password', {
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value
      });
      toast('Password updated.', 'success');
      e.target.reset();
    } catch (err) {
      toast(err.message || 'Could not update your password.', 'error');
    } finally { btn.disabled = false; }
  });

  /* ---------- Boot ---------- */
  try {
    await API.get('/api/auth/me');
    showDashboard();
  } catch {
    showAuth('login');
  }
});
