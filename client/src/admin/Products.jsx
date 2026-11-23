import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { money } from '../utils/format';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = {
  name: '', sku: '', category: '', price: '', compareAtPrice: '', supplierCost: '',
  stock: '', lowStockThreshold: '', status: 'active', featured: false,
  shortDescription: '', description: '', tags: ''
};

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState('loading');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [pfImages, setPfImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const debounce = useRef(null);

  const fetchProducts = useCallback(async (filters, targetPage) => {
    setState('loading');
    try {
      const params = { page: targetPage, limit: 12 };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.status) params.status = filters.status;
      if (filters.lowStock) params.lowStock = filters.lowStock;
      const { data } = await api.get('/admin/products', { params });
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPages(Math.max(1, data.pages || 1));
      setState('ready');
    } catch (err) {
      setProducts([]);
      setState('error');
      toast(err.message || 'Could not load products.', 'error');
    }
  }, [toast]);

  const currentFilters = () => ({ search, status, lowStock });
  useEffect(() => { fetchProducts(currentFilters(), page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = (e) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchProducts(currentFilters(), 1);
  };
  const onSearchChange = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); fetchProducts({ ...currentFilters(), search: value }, 1); }, 350);
  };

  /* ----- Categories for the editor ----- */
  const loadCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data.categories || []);
    } catch (err) {
      toast(err.message || 'Could not load categories.', 'error');
    }
  }, [toast]);

  /* ----- Editor open/close ----- */
  const openEditor = async (productId) => {
    await loadCategories();
    setFiles([]);
    if (productId) {
      try {
        const { data } = await api.get(`/admin/products/${encodeURIComponent(productId)}`);
        const p = data.product;
        setEditingId(p.id);
        setForm({
          name: p.name || '', sku: p.sku || '', category: (p.category && p.category.id) || '',
          price: p.price ?? '', compareAtPrice: p.compareAtPrice ?? '', supplierCost: p.supplierCost ?? '',
          stock: p.stock ?? '', lowStockThreshold: p.lowStockThreshold ?? '', status: p.status || 'active',
          featured: Boolean(p.featured), shortDescription: p.shortDescription || '', description: p.description || '',
          tags: (p.tags || []).join(', ')
        });
        setPfImages(p.images || []);
        setModalOpen(true);
      } catch (err) {
        toast(err.message || 'Could not load the product.', 'error');
      }
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setPfImages([]);
      setModalOpen(true);
    }
  };

  const closeEditor = () => setModalOpen(false);

  /* ----- Save ----- */
  const saveProduct = async (e) => {
    e.preventDefault();
    setBusy('save');
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice === '' ? null : Number(form.compareAtPrice),
      supplierCost: form.supplierCost === '' ? null : Number(form.supplierCost),
      stock: Math.floor(Number(form.stock)),
      lowStockThreshold: form.lowStockThreshold === '' ? null : Math.floor(Number(form.lowStockThreshold)),
      status: form.status,
      featured: form.featured,
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    };
    try {
      if (editingId) {
        await api.patch(`/admin/products/${encodeURIComponent(editingId)}`, payload);
        toast('Product saved.', 'success');
        closeEditor();
      } else {
        const { data } = await api.post('/admin/products', payload);
        setEditingId(data.product.id);
        setPfImages(data.product.images || []);
        toast('Product created — you can now add photos.', 'success');
      }
      fetchProducts(currentFilters(), page);
    } catch (err) {
      toast(err.message || 'Could not save the product.', 'error');
    } finally {
      setBusy('');
    }
  };

  /* ----- Archive / reactivate ----- */
  const toggleStatus = async (product) => {
    const makeInactive = product.status === 'active';
    if (makeInactive && !window.confirm('Archive this product? It will disappear from the storefront (orders keep their history).')) return;
    try {
      if (makeInactive) {
        await api.delete(`/admin/products/${encodeURIComponent(product.id)}`);
        toast('Product archived (set to Inactive).', 'success');
      } else {
        await api.patch(`/admin/products/${encodeURIComponent(product.id)}`, { status: 'active' });
        toast('Product reactivated.', 'success');
      }
      fetchProducts(currentFilters(), page);
    } catch (err) {
      toast(err.message || 'Could not update the product.', 'error');
    }
  };

  /* ----- Images ----- */
  const uploadImages = async () => {
    if (!editingId) { toast('Save the product first, then upload photos.', 'error'); return; }
    if (!files.length) { toast('Choose one or more photos first.', 'error'); return; }
    const fd = new FormData();
    for (const f of files) fd.append('images', f);
    setBusy('upload');
    try {
      const { data } = await api.post(`/admin/products/${encodeURIComponent(editingId)}/images`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPfImages(data.product.images || []);
      setFiles([]);
      const input = document.getElementById('pfImageFiles');
      if (input) input.value = '';
      toast('Photos uploaded.', 'success');
      fetchProducts(currentFilters(), page);
    } catch (err) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeImage = async (imageId) => {
    if (!editingId || !window.confirm('Remove this photo?')) return;
    try {
      const { data } = await api.delete(`/admin/products/${encodeURIComponent(editingId)}/images/${encodeURIComponent(imageId)}`);
      setPfImages(data.product.images || []);
      fetchProducts(currentFilters(), page);
    } catch (err) {
      toast(err.message || 'Could not remove the photo.', 'error');
    }
  };

  return (
    <>
      <div className="topbar">
        <div><div className="crumb">Catalogue</div><h1>Products</h1></div>
        <button type="button" className="btn btn-gold btn-sm" onClick={() => openEditor(null)}>+ Add product</button>
      </div>

      <form className="filters no-print" onSubmit={applyFilters}>
        <div style={{ minWidth: 200, flex: 1 }}><label className="field-label" htmlFor="productSearch">Search</label>
          <input type="text" id="productSearch" placeholder="Name, SKU or keyword…" style={{ width: '100%' }} value={search} onChange={(e) => onSearchChange(e.target.value)} /></div>
        <div><label className="field-label" htmlFor="productStatusFilter">Status</label>
          <select id="productStatusFilter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select></div>
        <div><label className="field-label" htmlFor="productLowStock">Stock</label>
          <select id="productLowStock" value={lowStock} onChange={(e) => setLowStock(e.target.value)}>
            <option value="">All</option><option value="true">Low stock only</option>
          </select></div>
        <button type="submit" className="btn btn-sm">Apply</button>
      </form>

      <div className="prod-grid">
        {state === 'loading' && <div className="empty">Loading…</div>}
        {state === 'error' && <div className="empty">Could not load products.</div>}
        {state === 'ready' && products.length === 0 && <div className="empty">No products found.</div>}
        {state === 'ready' && products.map((p) => {
          const cover = (p.images && p.images[0] && p.images[0].url) || '/images/favicon.svg';
          const stockCls = p.stock === 0 ? 'stock-out' : p.stock <= 5 ? 'stock-low' : 'stock-ok';
          return (
            <div className="prod-card" key={p.id}>
              <img src={cover} alt={p.name} loading="lazy" />
              <div className="body">
                <b>{p.name}</b>
                <div className="meta"><span className={`status-dot ${p.status === 'active' ? 'dot-active' : 'dot-inactive'}`}></span>{p.status} · SKU {p.sku}{p.featured ? ' · ★ Featured' : ''}</div>
                <div className="price-row"><strong>{money(p.price)}</strong><span className={stockCls}>{p.stock} in stock</span></div>
                <div className="meta">Cost: {p.supplierCost !== null && p.supplierCost !== undefined ? money(p.supplierCost) : 'not set'}{p.compareAtPrice ? ` · MRP ${money(p.compareAtPrice)}` : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditor(p.id)}>Edit</button>
                  <button type="button" className={`btn btn-sm ${p.status === 'active' ? 'btn-outline' : 'btn-gold'}`} onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Archive' : 'Reactivate'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span className="muted">{state === 'ready' && `${total} product(s) · page ${page} of ${pages}`}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next →</button>
        </div>
      </div>

      {/* Product editor modal */}
      {modalOpen && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label="Product editor" onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}>
          <form className="modal" onSubmit={saveProduct}>
            <h2>{editingId ? 'Edit product' : 'Add product'}</h2>
            <div className="two-col">
              <div className="field" style={{ gridColumn: '1/-1' }}><label className="field-label" htmlFor="pfName">Name *</label>
                <input type="text" id="pfName" required maxLength={140} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfSku">SKU *</label>
                <input type="text" id="pfSku" required maxLength={60} placeholder="SC-GS-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfCategory">Category *</label>
                <select id="pfCategory" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
                </select></div>
              <div className="field"><label className="field-label" htmlFor="pfPrice">Selling price (₹) *</label>
                <input type="number" id="pfPrice" required min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfCompareAt">Compare-at price (₹, optional)</label>
                <input type="number" id="pfCompareAt" min="0" step="0.01" value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfSupplierCost">Supplier cost (₹, private)</label>
                <input type="number" id="pfSupplierCost" min="0" step="0.01" placeholder="Never shown to customers" value={form.supplierCost} onChange={(e) => setForm({ ...form, supplierCost: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfStock">Stock quantity *</label>
                <input type="number" id="pfStock" required min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfLowStock">Low-stock alert at</label>
                <input type="number" id="pfLowStock" min="0" step="1" placeholder="Store default" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} /></div>
              <div className="field"><label className="field-label" htmlFor="pfStatus">Status</label>
                <select id="pfStatus" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option><option value="inactive">Inactive</option>
                </select></div>
              <div className="field" style={{ display: 'flex', alignItems: 'end', paddingBottom: 6 }}>
                <label className="checkbox-row"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured on homepage</label></div>
              <div className="field" style={{ gridColumn: '1/-1' }}><label className="field-label" htmlFor="pfShort">Short description</label>
                <textarea id="pfShort" maxLength={240} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1/-1' }}><label className="field-label" htmlFor="pfDescription">Full description</label>
                <textarea id="pfDescription" maxLength={4000} style={{ minHeight: 90 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="field" style={{ gridColumn: '1/-1' }}><label className="field-label" htmlFor="pfTags">Tags (comma separated)</label>
                <input type="text" id="pfTags" placeholder="gift set, unisex" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            </div>

            <div className="field"><span className="field-label">Product photos</span>
              <div className="img-row">
                {pfImages.map((img) => (
                  <div className="img-thumb" key={img.id}>
                    <img src={img.url} alt={img.alt || ''} />
                    <button type="button" title="Remove photo" onClick={() => removeImage(img.id)}>✕</button>
                  </div>
                ))}
              </div>
              <input type="file" id="pfImageFiles" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => setFiles([...e.target.files])} />
              <p className="muted" style={{ fontSize: 10.5, margin: '6px 0 0' }}>Uploads go to Cloudinary. First photo is the cover. Max 8 new files, 5 MB each, 12 total.</p>
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={uploadImages} disabled={busy === 'upload'}>{busy === 'upload' ? 'Uploading…' : 'Upload selected photos'}</button>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn btn-outline" onClick={closeEditor}>Cancel</button>
              <button type="submit" className="btn btn-gold" disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save product'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
