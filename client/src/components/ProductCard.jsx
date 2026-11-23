import { Link } from 'react-router-dom';
import { money } from '../utils/format';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const { toast } = useToast();
  const images = product.images || [];
  const cover = (images[0] && images[0].url) || '/images/products/gift-set-1.jpg';
  const save =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(100 - (product.price * 100) / product.compareAtPrice)
      : 0;

  const addToCart = (e) => {
    e.preventDefault();
    add(
      { id: product.id, slug: product.slug, name: product.name, price: product.price, image: cover },
      1
    );
    toast('Added to your cart', 'success');
  };

  return (
    <article className="product">
      <Link className="product-art" to={`/product/${product.slug}`} aria-label={product.name}>
        <img src={cover} alt={(images[0] && images[0].alt) || product.name} loading="lazy" />
        {save > 0 && <span className="product-badge save">Save {save}%</span>}
        {product.inStock === false && <span className="oos-badge">Out of stock</span>}
      </Link>
      <div className="product-info">
        <div className="tag">{(product.category && product.category.name) || 'Perfume'}</div>
        <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
        <div className="desc">{product.shortDescription || ''}</div>
        <div className="price">
          <strong>{money(product.price)}</strong>
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <>
              <del>{money(product.compareAtPrice)}</del>
              <span className="save-note">You save {money(product.compareAtPrice - product.price)}</span>
            </>
          ) : null}
        </div>
        <button type="button" className="btn btn-full" onClick={addToCart} disabled={product.inStock === false}>
          {product.inStock === false ? 'Out of stock' : 'Add to Cart'}
        </button>
      </div>
    </article>
  );
}
