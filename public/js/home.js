'use strict';
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('featuredProducts');
  const state = document.getElementById('featuredState');
  try {
    const data = await window.ScentoraAPI.get('/api/products?featured=true&limit=6');
    const products = data.products || [];
    if (!products.length) {
      state.textContent = 'No featured products right now — please check back soon.';
      return;
    }
    grid.innerHTML = products.map(window.Scentora.productCardHTML).join('');
    state.remove();
  } catch (err) {
    state.textContent = err.message || 'Could not load products. Please refresh the page.';
    state.classList.add('error');
  }
});
