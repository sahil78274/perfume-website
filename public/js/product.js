'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const { money, escapeHtml, toast, productCardHTML } = window.Scentora;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  const loading = document.getElementById('productLoading');
  const errorBox = document.getElementById('productError');
  const detail = document.getElementById('productDetail');
  const descPanel = document.getElementById('descriptionPanel');

  if (!slug) {
    loading.classList.add('hidden');
    errorBox.textContent = 'No product specified. Browse the shop instead.';
    errorBox.classList.remove('hidden');
    return;
  }

  let product;
  try {
    const data = await window.ScentoraAPI.get('/api/products/' + encodeURIComponent(slug));
    product = data.product;
  } catch (err) {
    loading.classList.add('hidden');
    errorBox.textContent = err.status === 404 ? 'This product could not be found (it may be out of season or discontinued).' : (err.message || 'Could not load this product.');
    errorBox.classList.remove('hidden');
    return;
  }

  /* Populate page */
  document.title = `${product.name} — SCENTORA`;
  document.getElementById('crumbName').textContent = product.name;
  document.getElementById('productTag').textContent = (product.category && product.category.name) || 'Perfume';
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productPrice').textContent = money(product.price);
  document.getElementById('productShort').textContent = product.shortDescription || '';

  const mrp = document.getElementById('productMrp');
  const saveNote = document.getElementById('productSave');
  if (product.compareAtPrice && product.compareAtPrice > product.price) {
    mrp.textContent = money(product.compareAtPrice);
    mrp.classList.remove('hidden');
    saveNote.textContent = `You save ${money(product.compareAtPrice - product.price)}`;
    saveNote.classList.remove('hidden');
  }

  const stockLine = document.getElementById('stockLine');
  const inStock = product.inStock !== false;
  stockLine.innerHTML = inStock
    ? '<span style="color:var(--ok);font-weight:700">● In stock</span> — usually dispatched after phone confirmation'
    : '<span style="color:var(--danger);font-weight:700">● Out of stock</span> — please check back soon';

  const addBtn = document.getElementById('addToCartBtn');
  const buyBtn = document.getElementById('buyNowBtn');
  if (!inStock) {
    addBtn.disabled = true;
    buyBtn.disabled = true;
    addBtn.textContent = 'Out of stock';
    buyBtn.textContent = 'Out of stock';
  }

  /* Specs */
  const specsBody = document.querySelector('#specsTable tbody');
  const specs = Array.isArray(product.specs) ? product.specs : [];
  specsBody.innerHTML = specs.length
    ? specs.map((s) => `<tr><td>${escapeHtml(s.label)}</td><td>${escapeHtml(s.value)}</td></tr>`).join('')
    : '<tr><td>Contents</td><td>See product description</td></tr>';

  if (product.description) {
    document.getElementById('productDescription').textContent = product.description;
    descPanel.classList.remove('hidden');
  }

  loading.classList.add('hidden');
  detail.classList.remove('hidden');

  /* Gallery */
  const images = (product.images && product.images.length ? product.images : [{ url: '/images/products/gift-set-1.jpg', alt: product.name }]);
  let index = 0;
  const imgEl = document.getElementById('galleryImage');
  const dotsWrap = document.getElementById('galleryDots');
  dotsWrap.innerHTML = images.map((_, i) => `<button type="button" data-i="${i}" aria-label="Photo ${i + 1}"></button>`).join('');
  const dots = [...dotsWrap.children];

  function render(i) {
    index = (i + images.length) % images.length;
    imgEl.src = images[index].url;
    imgEl.alt = images[index].alt || product.name;
    dots.forEach((d, di) => d.classList.toggle('active', di === index));
  }
  document.getElementById('galleryPrev').addEventListener('click', () => render(index - 1));
  document.getElementById('galleryNext').addEventListener('click', () => render(index + 1));
  dotsWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (btn) render(Number(btn.dataset.i));
  });
  render(0);

  /* Lightbox */
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  imgEl.addEventListener('click', () => {
    lightboxImage.src = images[index].url;
    lightboxImage.alt = images[index].alt || product.name;
    lightbox.classList.add('show');
  });
  const closeLightbox = () => lightbox.classList.remove('show');
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

  /* Quantity + cart actions */
  const qtyInput = document.getElementById('qtyInput');
  const clampQty = () => { qtyInput.value = String(Math.min(20, Math.max(1, Math.floor(Number(qtyInput.value) || 1)))); };
  document.getElementById('qtyMinus').addEventListener('click', () => { qtyInput.value = String(Number(qtyInput.value) - 1); clampQty(); });
  document.getElementById('qtyPlus').addEventListener('click', () => { qtyInput.value = String(Number(qtyInput.value) + 1); clampQty(); });
  qtyInput.addEventListener('change', clampQty);

  const cartPayload = () => ({
    id: product.id, slug: product.slug, name: product.name, price: product.price,
    image: (product.images && product.images[0] && product.images[0].url) || ''
  });
  addBtn.addEventListener('click', () => {
    if (!inStock) return;
    window.ScentoraCart.add(cartPayload(), Number(qtyInput.value) || 1);
    toast('Added to your cart', 'success');
  });
  buyBtn.addEventListener('click', () => {
    if (!inStock) return;
    window.ScentoraCart.add(cartPayload(), Number(qtyInput.value) || 1);
    window.location.href = '/checkout.html';
  });

  /* Related products (same category) */
  try {
    const rel = await window.ScentoraAPI.get('/api/products?limit=3&category=' + encodeURIComponent((product.category && product.category.slug) || ''));
    const related = (rel.products || []).filter((p) => p.slug !== product.slug).slice(0, 3);
    document.getElementById('relatedProducts').innerHTML = related.length
      ? related.map(productCardHTML).join('')
      : '<p class="state-box">More products coming soon.</p>';
  } catch {
    document.getElementById('relatedProducts').innerHTML = '';
  }
});
