'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const { money, escapeHtml, badgeFor } = window.Scentora;
  const API = window.ScentoraAPI;
  const wrap = document.getElementById('confirmationContent');

  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem('scentora_last_order') || 'null'); } catch { stored = null; }

  if (!stored || !stored.orderNumber) {
    wrap.innerHTML = `
      <div class="empty-state">
        <h3>Order placed!</h3>
        <p>We couldn't reload the details on this device. You can look up your order any time with your order ID and mobile number.</p>
        <a class="btn" href="/track-order.html" style="margin-top:10px">Track my order</a>
      </div>`;
    return;
  }

  function timelineHTML(status) {
    const steps = ['New Order', 'Confirmed', 'Supplier Order Placed', 'Shipped', 'Out for Delivery', 'Delivered'];
    if (['Cancelled', 'RTO', 'Returned'].includes(status)) {
      return `<div class="cod-note" style="background:#fdeeee;border-color:#ecc9c9;color:#a33"><span>This order is marked <strong>${escapeHtml(status)}</strong>. Please contact support if you believe this is a mistake.</span></div>`;
    }
    const current = Math.max(0, steps.indexOf(status));
    return `<ul class="timeline">${steps.map((s, i) => `<li class="${i < current ? 'done' : i === current ? 'done now' : ''}"><strong>${escapeHtml(s)}</strong></li>`).join('')}</ul>`;
  }

  try {
    const data = await API.post('/api/orders/track', { orderNumber: stored.orderNumber, phone: stored.phone });
    const o = data.order;
    const items = (o.items || []).map((i) => `
      <div class="osi-row"><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.lineTotal)}</span></div>`).join('');
    const addr = o.shippingAddress || {};
    wrap.innerHTML = `
      <div style="text-align:center;margin:8px 0 22px">
        <div style="width:74px;height:74px;border-radius:50%;background:#1c6e3c;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h1 class="serif" style="font-weight:400;font-size:32px;margin:0 0 6px">Order received!</h1>
        <p style="color:var(--muted);margin:0">Thank you, ${escapeHtml(o.contact.name)}. We'll call <strong>${escapeHtml(o.contact.phone)}</strong> to confirm your order before dispatch.</p>
        <div style="margin-top:12px"><span class="pill ${badgeFor(o.status).split(' ')[1] || 'pill-other'}">${escapeHtml(o.status)}</span></div>
      </div>

      <div class="panel">
        <div class="panel-title"><h2 class="serif" style="font-weight:400;font-size:20px;margin:0">Order ${escapeHtml(o.orderNumber)}</h2><span class="badge-cod">COD · ${money(o.total)}</span></div>
        ${items}
        <div class="summary-row"><span>Subtotal</span><span>${money(o.itemsSubtotal)}</span></div>
        <div class="summary-row"><span>Shipping</span><span>${o.shippingCharge === 0 ? 'FREE' : money(o.shippingCharge)}</span></div>
        <div class="summary-row total"><span>Total payable on delivery</span><span>${money(o.total)}</span></div>
      </div>

      <div class="panel">
        <h3>Delivery details</h3>
        <p style="font-size:13.5px;line-height:1.8;margin:6px 0">${escapeHtml([addr.houseAndStreet, addr.area, addr.city, addr.state].filter(Boolean).join(', '))}<br>PIN ${escapeHtml(addr.pincode)}${addr.landmark ? '<br>Landmark: ' + escapeHtml(addr.landmark) : ''}</p>
        <h3 style="margin-top:16px">What happens next</h3>
        ${timelineHTML(o.status)}
      </div>

      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:18px">
        <a class="btn" href="/shop.html">Continue shopping</a>
        <a class="btn btn-outline" href="/track-order.html">Track this order</a>
        <a class="btn btn-outline" href="/account.html">My orders</a>
      </div>`;
  } catch (err) {
    wrap.innerHTML = `
      <div class="empty-state">
        <h3>Order placed!</h3>
        <p>Your order was received, but we couldn't load the details right now. You can look it up any time:</p>
        <a class="btn" href="/track-order.html" style="margin-top:10px">Track my order</a>
      </div>`;
  }
});
