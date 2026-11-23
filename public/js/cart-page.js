'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const { money, escapeHtml } = window.Scentora;
  const cart = window.ScentoraCart;
  const itemsWrap = document.getElementById('cartItems');
  const content = document.getElementById('cartContent');
  const empty = document.getElementById('cartEmpty');

  let shippingCharge = 0;
  let freeShippingAbove = null;
  try {
    const settings = await window.ScentoraAPI.get('/api/settings');
    shippingCharge = Number(settings.shippingCharge) || 0;
    freeShippingAbove = settings.freeShippingAbove === null || settings.freeShippingAbove === undefined ? null : Number(settings.freeShippingAbove);
  } catch { /* fall back to free shipping display */ }

  function render() {
    const items = cart.items();
    if (!items.length) {
      content.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    content.classList.remove('hidden');

    itemsWrap.innerHTML = items.map((item) => `
      <div class="cart-item" data-id="${escapeHtml(item.id)}">
        <a href="/product.html?slug=${encodeURIComponent(item.slug)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></a>
        <div>
          <div style="font-weight:700;font-size:14px;line-height:1.4">${escapeHtml(item.name)}</div>
          <div style="font-size:13px;color:var(--muted);margin:4px 0">${money(item.price)} each</div>
          <div class="qty-control">
            <button type="button" data-act="dec" aria-label="Decrease quantity">−</button>
            <input type="number" min="1" max="20" value="${item.qty}" aria-label="Quantity">
            <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
          </div>
          <div><button class="remove-link" type="button" data-act="remove">Remove from cart</button></div>
        </div>
        <div style="font-weight:700;font-size:15px">${money(item.price * item.qty)}</div>
      </div>`).join('');

    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    const shipping = freeShippingAbove !== null && subtotal >= freeShippingAbove ? 0 : shippingCharge;
    document.getElementById('summarySubtotal').textContent = money(subtotal);
    document.getElementById('summaryShipping').textContent = shipping === 0 ? 'FREE' : money(shipping);
    document.getElementById('summaryTotal').textContent = money(subtotal + shipping);
  }

  itemsWrap.addEventListener('click', (event) => {
    const row = event.target.closest('.cart-item');
    if (!row) return;
    const id = row.dataset.id;
    const act = event.target.closest('[data-act]')?.dataset.act;
    const item = cart.items().find((i) => i.id === id);
    if (!item) return;
    if (act === 'inc') cart.setQty(id, item.qty + 1);
    else if (act === 'dec') cart.setQty(id, item.qty - 1);
    else if (act === 'remove') cart.remove(id);
    else return;
    render();
  });

  itemsWrap.addEventListener('change', (event) => {
    const row = event.target.closest('.cart-item');
    if (!row || event.target.tagName !== 'INPUT') return;
    cart.setQty(row.dataset.id, Number(event.target.value));
    render();
  });

  window.addEventListener('scentora:cart-changed', render);
  render();
});
