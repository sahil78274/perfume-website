export const money = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const fmtDate = (d) => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (d) => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fmtDateInput = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

export function pillClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered') return 'pill pill-delivered';
  if (['cancelled', 'rto', 'returned'].includes(s)) return 'pill pill-cancelled';
  if (s === 'new order') return 'pill pill-new';
  if (['confirmed', 'supplier order placed', 'shipped', 'out for delivery'].includes(s)) return 'pill pill-progress';
  return 'pill pill-other';
}

export const ORDER_STEPS = ['New Order', 'Confirmed', 'Supplier Order Placed', 'Shipped', 'Out for Delivery', 'Delivered'];

export const ORDER_STATUSES = [...ORDER_STEPS, 'Cancelled', 'RTO', 'Returned'];
