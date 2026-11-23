const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

/** Convert an Indian mobile number to wa.me's country-code + national-number digits. */
export function normalizeWhatsAppPhone(value) {
  const digits = String(value ?? '').trim().replace(/\D/g, '');
  let nationalNumber = digits;

  if (digits.startsWith('0091') && digits.length === 14) nationalNumber = digits.slice(4);
  else if (digits.startsWith('91') && digits.length === 12) nationalNumber = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) nationalNumber = digits.slice(1);

  if (!INDIAN_MOBILE_RE.test(nationalNumber)) return '';
  return `91${nationalNumber}`;
}

export function buildWhatsAppOrderMessage(order) {
  const products = (order.items || [])
    .map((item) => `${String(item.name || '').trim()} × ${Number(item.qty) || 0}`)
    .filter((item) => !item.startsWith(' × '))
    .join(', ');
  const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })
    .format(Number(order.total) || 0);

  return `Hello ${String(order.name || '').trim()}!\n\nThank you for ordering from SCENTORA.\n\nYour order details:\nOrder ID: ${order.orderNumber}\nProducts: ${products}\nTotal Amount: ₹${amount}\nPayment: Cash on Delivery\n\nPlease confirm whether you want to proceed with this order.\n\nThank you,\nTeam SCENTORA`;
}

export function buildWhatsAppOrderUrl(order) {
  const phone = normalizeWhatsAppPhone(order.phone);
  if (!phone) return '';
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppOrderMessage(order))}`;
}
