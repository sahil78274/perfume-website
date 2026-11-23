import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'scentora_cart_v1';
const MAX_QTY = 20;

function readCart() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i) => i && i.id && Number(i.qty) > 0)
      .map((i) => ({
        id: String(i.id),
        slug: String(i.slug || ''),
        name: String(i.name || 'Product'),
        price: Number(i.price) || 0,
        image: String(i.image || ''),
        qty: Math.min(MAX_QTY, Math.max(1, Math.floor(Number(i.qty))))
      }));
  } catch {
    return [];
  }
}

const CartContext = createContext(null);

/** Persistent cart — localStorage holds ONLY the cart (never orders or account data). */
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage full — cart still works for the session */
    }
  }, [items]);

  const add = useCallback((item, qty = 1) => {
    const q = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(qty) || 1)));
    setItems((cart) => {
      const idx = cart.findIndex((i) => i.id === String(item.id));
      if (idx >= 0) {
        const next = [...cart];
        next[idx] = { ...next[idx], qty: Math.min(MAX_QTY, next[idx].qty + q) };
        return next;
      }
      return [...cart, {
        id: String(item.id), slug: item.slug || '', name: item.name,
        price: Number(item.price) || 0, image: item.image || '', qty: q
      }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    const q = Math.floor(Number(qty));
    setItems((cart) =>
      !Number.isFinite(q) || q <= 0
        ? cart.filter((i) => i.id !== String(id))
        : cart.map((i) => (i.id === String(id) ? { ...i, qty: Math.min(MAX_QTY, q) } : i))
    );
  }, []);

  const remove = useCallback((id) => setItems((cart) => cart.filter((i) => i.id !== String(id))), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({
    items,
    count: items.reduce((a, i) => a + i.qty, 0),
    subtotal: items.reduce((a, i) => a + i.qty * i.price, 0),
    add,
    setQty,
    remove,
    clear
  }), [items, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
