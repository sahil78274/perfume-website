'use strict';
/* Shared UI helpers */
window.Scentora = (function () {
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function toast(message, type) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = 'toast'; }, 4200);
  }

  function badgeFor(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') return 'pill pill-delivered';
    if (s === 'cancelled' || s === 'rto' || s === 'returned') return 'pill pill-cancelled';
    if (s === 'new order') return 'pill pill-new';
    if (['confirmed', 'supplier order placed', 'shipped', 'out for delivery'].includes(s)) return 'pill pill-progress';
    return 'pill pill-other';
  }

  /** Product card used on home/shop/product pages. */
  function productCardHTML(p) {
    const img = (p.images && p.images[0] && p.images[0].url) || '/images/products/gift-set-1.jpg';
    const save = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round(100 - (p.price * 100) / p.compareAtPrice) : 0;
    return `
    <article class="product" data-product-id="${escapeHtml(p.id)}">
      <a class="product-art" href="/product.html?slug=${encodeURIComponent(p.slug)}" aria-label="${escapeHtml(p.name)}">
        <img src="${escapeHtml(img)}" alt="${escapeHtml((p.images && p.images[0] && p.images[0].alt) || p.name)}" loading="lazy">
        ${save ? `<span class="product-badge save">Save ${save}%</span>` : ''}
        ${p.inStock === false ? '<span class="oos-badge">Out of stock</span>' : ''}
      </a>
      <div class="product-info">
        <div class="tag">${escapeHtml((p.category && p.category.name) || 'Perfume')}</div>
        <h3><a href="/product.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></h3>
        <div class="desc">${escapeHtml(p.shortDescription || '')}</div>
        <div class="price"><strong>${money(p.price)}</strong>${p.compareAtPrice && p.compareAtPrice > p.price ? `<del>${money(p.compareAtPrice)}</del><span class="save-note">You save ${money(p.compareAtPrice - p.price)}</span>` : ''}</div>
        <button class="btn btn-full js-add-cart" data-id="${escapeHtml(p.id)}" data-slug="${escapeHtml(p.slug)}" data-name="${escapeHtml(p.name)}" data-price="${Number(p.price)}" data-image="${escapeHtml(img)}">Add to Cart</button>
      </div>
    </article>`;
  }

  function isLoggedIn() {
    // Cheap hint only — the server is authoritative on every request.
    return window.__scentoraCustomer === true;
  }

  return { money, escapeHtml, toast, badgeFor, productCardHTML, isLoggedIn };
})();
