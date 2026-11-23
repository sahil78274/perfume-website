'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('productsGrid');
  const state = document.getElementById('shopState');
  const summary = document.getElementById('resultSummary');
  const form = document.getElementById('filtersForm');
  const categorySelect = document.getElementById('categorySelect');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  let page = 1;
  let pages = 1;
  let debounceTimer = null;

  // Pre-select category/search from the URL query (?category=&search=)
  const params = new URLSearchParams(window.location.search);
  if (params.get('search')) document.getElementById('searchInput').value = params.get('search');
  if (params.get('category')) categorySelect.dataset.pending = params.get('category');

  async function loadCategories() {
    try {
      const data = await window.ScentoraAPI.get('/api/categories');
      for (const cat of data.categories || []) {
        const opt = document.createElement('option');
        opt.value = cat.slug;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
      }
      if (categorySelect.dataset.pending) {
        categorySelect.value = categorySelect.dataset.pending;
        delete categorySelect.dataset.pending;
      }
    } catch { /* categories are optional for filtering */ }
  }

  function currentQuery() {
    const q = new URLSearchParams();
    const search = document.getElementById('searchInput').value.trim();
    const category = categorySelect.value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;
    const sort = document.getElementById('sortSelect').value;
    if (search) q.set('search', search);
    if (category) q.set('category', category);
    if (minPrice) q.set('minPrice', minPrice);
    if (maxPrice) q.set('maxPrice', maxPrice);
    if (sort) q.set('sort', sort);
    q.set('page', String(page));
    q.set('limit', '12');
    return q.toString();
  }

  async function load() {
    state.textContent = 'Loading products…';
    state.classList.remove('error', 'hidden');
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = true;
    try {
      const data = await window.ScentoraAPI.get('/api/products?' + currentQuery());
      const products = data.products || [];
      pages = data.pages || 1;
      summary.textContent = `${data.total || 0} product${data.total === 1 ? '' : 's'} found · Page ${page} of ${Math.max(pages, 1)}`;
      if (!products.length) {
        grid.innerHTML = '';
        state.innerHTML = 'No products match those filters. <button class="linkish" id="clearInline">Clear filters</button>';
        const clearBtn = document.getElementById('clearInline');
        if (clearBtn) clearBtn.addEventListener('click', resetAll);
        nextBtn.disabled = true;
        return;
      }
      state.classList.add('hidden');
      grid.innerHTML = products.map(window.Scentora.productCardHTML).join('');
      nextBtn.disabled = page >= pages;
    } catch (err) {
      grid.innerHTML = '';
      state.textContent = err.message || 'Could not load products. Please try again.';
      state.classList.add('error');
    }
  }

  function resetAll() {
    form.reset();
    page = 1;
    load();
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; load(); });
  document.getElementById('resetFilters').addEventListener('click', resetAll);
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { page = 1; load(); }, 350);
  });
  prevBtn.addEventListener('click', () => { if (page > 1) { page -= 1; load(); window.scrollTo(0, 0); } });
  nextBtn.addEventListener('click', () => { if (page < pages) { page += 1; load(); window.scrollTo(0, 0); } });

  (async () => {
    await loadCategories();
    load();
  })();
});
