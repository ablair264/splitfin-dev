// src/components/ProductSelection.tsx
import React, { useEffect, useState } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import FirebaseImage from './FirebaseImage';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  // any other fields you need…
}

interface Selection {
  product: Product;
  quantity: number;
}

const ProductSelection: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'products'));
      const items = snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
      })) as Product[];
      setProducts(items);
    })();
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleQtyChange = (sku: string, val: number) => {
    setQuantities(q => ({ ...q, [sku]: Math.max(0, val) }));
  };

  const handleReview = () => {
    const selections: Selection[] = filtered
      .map(p => ({ product: p, quantity: quantities[p.sku] || 0 }))
      .filter(s => s.quantity > 0);
    if (selections.length === 0) return alert('Please select at least one item');
    navigate('/orders/review', { state: { selections } });
  };

  return (
    <div className="product-selection">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="product-list">
        {filtered.map(product => (
          <div key={product.id} className="product-card">
            <FirebaseImage
              sku={product.sku}
              className="thumb"
            />
            <div className="info">
              <h3>{product.name}</h3>
              <p className="sku">SKU: {product.sku}</p>
              <div className="qty-stepper">
                <button onClick={() => handleQtyChange(product.sku, (quantities[product.sku]||0) - 1)}>-</button>
                <span>{quantities[product.sku] || 0}</span>
                <button onClick={() => handleQtyChange(product.sku, (quantities[product.sku]||0) + 1)}>+</button>
              </div>
            </div>
            <button
              className="info-btn"
              onClick={() => setDetailProduct(product)}
            >
              ℹ️
            </button>
          </div>
        ))}
      </div>

      <div className="review-bar">
        <button onClick={handleReview}>
          🛒 Review Order
        </button>
      </div>

      {detailProduct && (
        <div className="modal-overlay" onClick={() => setDetailProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {/* Here you could reuse or build a ProductDetail component */}
            <h2>{detailProduct.name}</h2>
            <p>SKU: {detailProduct.sku}</p>
            <p>Price: £{detailProduct.basePrice.toFixed(2)}</p>
            <button onClick={() => setDetailProduct(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSelection;
