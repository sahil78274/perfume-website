'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const { money, escapeHtml, badgeFor, toast } = window.Scentora;
  const API = window.ScentoraAPI;
  const form = document.getElementById('trackForm');
  const btn = document.getElementById('trackBtn');
  const result = document.getElementById('trackResult');

  const STEPS = ['New Order', 'Confirmed', 'Supplier Order Placed', 'Shipped', 'Out for Delivery', 'Delivered'];

  function timelineHTML(status, history) {
    if (['Cancelled', 'RTO', 'Returned'].includes(status)) {
      const lastNote = (history && history.length ? history[history.length - 1].note : '') || '';
      return `<div class="cod-note" style="background:#fdeeee;border-color:#ecc9c9;color:#a33"><span><strong>${escapeHtml(status)}</strong>${lastNote ? ' — ' + escapeHtml(lastNote) : ''}</span></div>`;
    }
    const current = Math.max(0, STEPS.indexOf(status));
    return `<ul class="timeline">${STEPS.map((s, i) => `<li class="${i < current ? 'done' : i === current ? 'done now' : ''}"><strong>${escapeHtml(s)}</strong></li>`).join('')}</ul>`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const orderNumber = document.getElementById('orderNumber').value.trim().toUpperCase();
    const phone = document.getElementById('trackPhone').value.trim();
    btn.disabled = true;
    btn.textContent = 'Looking up…';
    try {
      const data = await API.post('/api/orders/track', { orderNumber, phone });
      const o = data.order;
      const items = (o.items || []).map((i) => `
        <div class="osi-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.lineTotal)}</span></div>`).join('');
      const addr = o.shippingAddress || {};
      const timeline = (o.timeline || []).map((t) => `<li class="done"><strong>${escapeHtml(t.status)}</strong><br><small>${new Date(t.at).toLocaleString('en-IN')}${t.note ? ' · ' + escapeHtml(t.note) : ''}</small></li>`).join('');
      result.innerHTML = `
        <div class="panel">
          <div class="panel-title"><h2 class="serif" style="font-weight:400;font-size:20px;margin:0">Order ${escapeHtml(o.orderNumber)}</h2><span class="${badgeFor(o.status)}">${escapeHtml(o.status)}</span></div>
          ${items}
          <div class="summary-row"><span>Subtotal</span><span>${money(o.itemsSubtotal)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
          <div class="summary-row total"><span>Total · COD</span><span>${money(o.total)}</span></div>
        </div>
        <div class="panel">
          <h3>Delivery to</h3>
          <p style="font-size:13px;line-height:1.7">${escapeHtml(o.contact.name)}<br>${escapeHtml([addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', '))}<br>PIN ${escapeHtml(addr.pincode)}</p>
          <h3 style="margin-top:14px">Progress</h3>
          ${timelineHTML(o.status, o.timeline)}
          <h3 style="margin-top:14px">History</h3>
          <ul class="timeline">${timeline}</ul>
        </div>`;
      result.classList.remove('hidden');
    } catch (err) {
      result.innerHTML = `<div class="state-box error">${escapeHtml(err.message || 'Could not find that order.')}</div>`;
      result.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Track order';
    }
  });
});
