'use strict';
/* Cart state — localStorage holds ONLY the cart (never orders or account data). */
window.ScentoraCart = (function () {
  const KEY = 'scentora_cart_v1';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((i) => i && i.id && Number(i.qty) > 0).map((i) => ({
        id: String(i.id), slug: String(i.slug || ''), name: String(i.name || 'Product'),
        price: Number(i.price) || 0, image: String(i.image || ''), qty: Math.min(20, Math.max(1, Math.floor(Number(i.qty))))
      })) : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    updateBadge();
    window.dispatchEvent(new CustomEvent('scentora:cart-changed', { detail: { items } }));
  }

  function items() { return read(); }

  function count() { return read().reduce((a, i) => a + i.qty, 0); }

  function subtotal() { return read().reduce((a, i) => a + i.qty * i.price, 0); }

  function add(item, qty) {
    const q = Math.min(20, Math.max(1, Math.floor(Number(qty) || 1)));
    const cart = read();
    const idx = cart.findIndex((i) => i.id === String(item.id));
    if (idx >= 0) cart[idx].qty = Math.min(20, cart[idx].qty + q);
    else cart.push({ id: String(item.id), slug: item.slug || '', name: item.name, price: Number(item.price) || 0, image: item.image || '', qty: q });
    write(cart);
  }

  function setQty(id, qty) {
    const q = Math.floor(Number(qty));
    let cart = read();
    if (!Number.isFinite(q) || q <= 0) cart = cart.filter((i) => i.id !== String(id));
    else cart = cart.map((i) => (i.id === String(id) ? { ...i, qty: Math.min(20, q) } : i));
    write(cart);
  }

  function remove(id) { write(read().filter((i) => i.id !== String(id))); }

  function clear() { write([]); }

  function updateBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    const c = count();
    badge.textContent = String(c);
    badge.style.display = c > 0 ? 'flex' : 'none';
  }

  /** Delegate "Add to Cart" buttons rendered anywhere on the page. */
  function bindAddButtons(root) {
    (root || document).addEventListener('click', (event) => {
      const btn = event.target.closest('.js-add-cart');
      if (!btn) return;
      event.preventDefault();
      add({ id: btn.dataset.id, slug: btn.dataset.slug, name: btn.dataset.name, price: Number(btn.dataset.price), image: btn.dataset.image }, 1);
      window.Scentora.toast('Added to your cart', 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', updateBadge);

  return { read, items, count, subtotal, add, setQty, remove, clear, updateBadge, bindAddButtons };
})();
