'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const { money, escapeHtml, toast } = window.Scentora;
  const API = window.ScentoraAPI;
  const cart = window.ScentoraCart;

  /* Indian states & union territories */
  const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
  const stateSelect = document.getElementById('custState');
  for (const s of STATES) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    stateSelect.appendChild(opt);
  }

  const form = document.getElementById('checkoutForm');
  const empty = document.getElementById('checkoutEmpty');
  const items = cart.items();
  if (!items.length) {
    empty.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  form.classList.remove('hidden');

  /* Idempotency key — one per cart state; reused across retries so we never double-create the order */
  const IDEMPOTENCY_KEY = 'scentora_checkout_key';
  const cartSignature = items.map((i) => `${i.id}:${i.qty}`).join('|');
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(IDEMPOTENCY_KEY) || 'null'); } catch { stored = null; }
  if (!stored || stored.signature !== cartSignature) {
    stored = { signature: cartSignature, key: crypto.randomUUID() };
    sessionStorage.setItem(IDEMPOTENCY_KEY, JSON.stringify(stored));
  }
  const idempotencyKey = stored.key;

  /* Summary */
  let shippingCharge = 0;
  let freeShippingAbove = null;
  try {
    const settings = await API.get('/api/settings');
    shippingCharge = Number(settings.shippingCharge) || 0;
    freeShippingAbove = settings.freeShippingAbove === null || settings.freeShippingAbove === undefined ? null : Number(settings.freeShippingAbove);
  } catch { /* show free shipping if settings unavailable */ }

  const subtotal = cart.subtotal();
  const shipping = freeShippingAbove !== null && subtotal >= freeShippingAbove ? 0 : shippingCharge;
  document.getElementById('summaryItems').innerHTML = items.map((i) => `
    <div class="osi-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('');
  document.getElementById('sumSubtotal').textContent = money(subtotal);
  document.getElementById('sumShipping').textContent = shipping === 0 ? 'FREE' : money(shipping);
  document.getElementById('sumTotal').textContent = money(subtotal + shipping);

  /* Prefill for logged-in customers + saved addresses */
  try {
    const me = await API.get('/api/auth/me');
    document.getElementById('custName').value = me.user.name || '';
    document.getElementById('custPhone').value = me.user.phone || '';
    document.getElementById('custEmail').value = me.user.email || '';
    const addrData = await API.get('/api/account/addresses');
    const addresses = addrData.addresses || [];
    if (addresses.length) {
      const block = document.getElementById('savedAddressBlock');
      const select = document.getElementById('savedAddressSelect');
      block.classList.remove('hidden');
      for (const a of addresses) {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.label || 'Address'} — ${a.houseAndStreet}, ${a.area}, ${a.city} (${a.pincode})${a.isDefault ? ' · Default' : ''}`;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        const a = addresses.find((x) => x.id === select.value);
        if (!a) return;
        document.getElementById('custHouse').value = a.houseAndStreet;
        document.getElementById('custArea').value = a.area;
        document.getElementById('custCity').value = a.city;
        stateSelect.value = a.state;
        document.getElementById('custPin').value = a.pincode;
        document.getElementById('custLandmark').value = a.landmark || '';
        if (a.fullName) document.getElementById('custName').value = a.fullName;
        if (a.phone) document.getElementById('custPhone').value = a.phone;
      });
    }
  } catch {
    document.getElementById('guestLoginHint').classList.remove('hidden');
  }

  /* Field-level validation (mirrors backend) */
  const validators = {
    name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
    phone: (v) => (/^[6-9]\d{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number.'),
    email: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address (or leave blank).'),
    houseAndStreet: (v) => (v.trim().length >= 2 ? '' : 'House number and street are required.'),
    area: (v) => (v.trim().length >= 2 ? '' : 'Area / locality is required.'),
    city: (v) => (v.trim().length >= 2 ? '' : 'City is required.'),
    state: (v) => (v ? '' : 'Please select your state.'),
    pincode: (v) => (/^[1-9]\d{5}$/.test(v.trim()) ? '' : 'Enter a valid 6-digit PIN code.'),
    notes: (v) => (v.length <= 500 ? '' : 'Notes must be 500 characters or fewer.')
  };

  function validateField(field) {
    const input = form.elements[field];
    const errorEl = document.getElementById('err-' + field);
    if (!input || !errorEl) return true;
    const message = validators[field] ? validators[field](input.value) : '';
    input.classList.toggle('invalid', Boolean(message));
    errorEl.textContent = message;
    errorEl.classList.toggle('show', Boolean(message));
    return !message;
  }

  for (const field of Object.keys(validators)) {
    const input = form.elements[field];
    if (input) input.addEventListener('blur', () => validateField(field));
  }

  const submitBtn = document.getElementById('placeOrderBtn');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = ['name', 'phone', 'email', 'houseAndStreet', 'area', 'city', 'state', 'pincode', 'notes'];
    const allValid = fields.map(validateField).every(Boolean);
    if (!allValid) {
      toast('Please fix the highlighted fields.', 'error');
      const firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const payload = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.trim(),
      email: form.elements.email.value.trim(),
      houseAndStreet: form.elements.houseAndStreet.value.trim(),
      area: form.elements.area.value.trim(),
      city: form.elements.city.value.trim(),
      state: form.elements.state.value,
      pincode: form.elements.pincode.value.trim(),
      landmark: form.elements.landmark.value.trim(),
      notes: form.elements.notes.value.trim(),
      items: cart.items().map((i) => ({ productId: i.id, qty: i.qty })),
      idempotencyKey
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Placing your order…';
    try {
      const result = await API.post('/api/orders', payload);
      try { sessionStorage.setItem('scentora_last_order', JSON.stringify({ orderNumber: result.order.orderNumber, phone: payload.phone })); } catch { /* ignore */ }
      cart.clear();
      sessionStorage.removeItem(IDEMPOTENCY_KEY);
      window.location.href = '/order-confirmation.html';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place COD order';
      toast(err.message || 'Could not place your order. Please try again.', 'error');
    }
  });
});
