'use strict';
/**
 * Response serializers. Anything internal (supplier cost, SKU, admin notes,
 * expense data) must pass through the admin serializers only.
 */

const PUBLIC_IMAGE_HOSTS = /res\.cloudinary\.com$|^\/images\/|^images\//;

function publicImage(images) {
  return (images || []).map((i) => ({ url: i.url, alt: i.alt || '' }));
}

function publicProduct(p, { includeStockCount = true } = {}) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    category: p.category && p.category.name ? { id: String(p.category._id), name: p.category.name, slug: p.category.slug } : p.category ? String(p.category) : null,
    price: p.price,
    compareAtPrice: p.compareAtPrice || null,
    images: publicImage(p.images),
    inStock: p.stock > 0,
    stock: includeStockCount ? p.stock : undefined,
    featured: Boolean(p.featured),
    tags: p.tags || [],
    specs: p.specs || [],
    createdAt: p.createdAt
  };
}

/** Full admin view — includes costs, SKU and stock internals. */
function adminProduct(p) {
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.shortDescription,
    description: p.description,
    category: p.category && p.category.name ? { id: String(p.category._id), name: p.category.name, slug: p.category.slug } : p.category ? String(p.category) : null,
    price: p.price,
    compareAtPrice: p.compareAtPrice || null,
    supplierCost: p.supplierCost ?? null,
    images: (p.images || []).map((i) => ({ id: String(i._id), url: i.url, publicId: i.publicId, alt: i.alt || '' })),
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold ?? null,
    status: p.status,
    featured: Boolean(p.featured),
    tags: p.tags || [],
    specs: p.specs || [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  };
}

/** Order as the customer may see it — no costs, no supplier data, no admin notes. */
function customerOrder(order, items, history) {
  return {
    orderNumber: order.orderNumber,
    status: order.status || 'New Order',
    paymentMethod: order.paymentMethod,
    contact: { name: order.contact.name, phone: order.contact.phone, email: order.contact.email },
    shippingAddress: order.shippingAddress,
    items: (items || []).map((i) => ({
      name: i.name,
      image: i.image,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal
    })),
    itemsCount: order.itemsCount,
    itemsSubtotal: order.itemsSubtotal,
    shippingCharge: order.shippingCharge,
    total: order.total,
    notes: order.notes,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    timeline: (history || []).map((h) => ({ status: h.status, note: h.note, at: h.createdAt }))
  };
}

/** Minimal public tracking view — never include delivery details, contact data, notes, or costs. */
function trackingOrder(order, items, history, trackingRef) {
  return {
    orderNumber: order.orderNumber,
    status: order.status || 'New Order',
    paymentMethod: order.paymentMethod,
    total: order.total,
    createdAt: order.createdAt,
    items: (items || []).map((item) => ({
      name: item.name,
      image: item.image || '',
      qty: item.qty
    })),
    timeline: (history || []).map((entry) => ({
      status: entry.status,
      at: entry.createdAt
    })),
    trackingInfo: trackingRef ? { reference: trackingRef } : null
  };
}

/** Full admin view of an order. */
function adminOrder(order, items, history, supplier, expenses, profit) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    isGuest: order.isGuest,
    user: order.user ? String(order.user) : null,
    contact: order.contact,
    shippingAddress: order.shippingAddress,
    items: (items || []).map((i) => ({
      id: String(i._id),
      product: i.product ? String(i.product) : null,
      name: i.name,
      image: i.image || '',
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      supplierCost: i.supplierCost ?? null
    })),
    itemsCount: order.itemsCount,
    itemsSubtotal: order.itemsSubtotal,
    shippingCharge: order.shippingCharge,
    total: order.total,
    status: order.status || 'New Order',
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    adminNotes: (order.adminNotes || []).map((n) => ({ id: String(n._id), text: n.text, adminName: n.adminName, createdAt: n.createdAt })),
    emailStatus: order.emailStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    timeline: (history || []).map((h) => ({ id: String(h._id), status: h.status, note: h.note, changedByName: h.changedByName, at: h.createdAt })),
    supplier: supplier ? {
      supplierName: supplier.supplierName,
      supplierProductRef: supplier.supplierProductRef,
      supplierOrderId: supplier.supplierOrderId,
      supplierPurchaseCost: supplier.supplierPurchaseCost,
      supplierOrderDate: supplier.supplierOrderDate,
      trackingRef: supplier.trackingRef,
      fulfilmentNotes: supplier.fulfilmentNotes,
      supplierStatus: supplier.supplierStatus
    } : null,
    expenses: (expenses || []).map((e) => ({ id: String(e._id), type: e.type, amount: e.amount, note: e.note, expenseDate: e.expenseDate })),
    profit: profit || null
  };
}

module.exports = { publicProduct, adminProduct, customerOrder, trackingOrder, adminOrder, publicImage };
