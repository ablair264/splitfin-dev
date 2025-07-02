// src/components/CustomerProducts/QuickViewModal.tsx
import React, { useState } from 'react';
import './QuickViewModal.css';

interface QuickViewModalProps {
  product: any;
  onClose: () => void;
  onAddToCart: (product: any, quantity: number) => void;
}

export default function QuickViewModal({ product, onClose, onAddToCart }: QuickViewModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const images = [product.imageUrl]; // Can be extended for multiple images

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    onClose();
  };

  return (
    <div className="quickview-overlay" onClick={onClose}>
      <div className="quickview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="quickview-close" onClick={onClose}>×</button>
        
        <div className="quickview-content">
          <div className="quickview-images">
            <div className="main-image">
              <img src={images[selectedImage]} alt={product.name} />
            </div>
            {images.length > 1 && (
              <div className="image-thumbnails">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    className={`thumbnail ${selectedImage === idx ? 'active' : ''}`}
                    onClick={() => setSelectedImage(idx)}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="quickview-info">
            <h2>{product.name}</h2>
            <p className="quickview-sku">SKU: {product.sku}</p>
            <div className="quickview-price">£{product.price.toFixed(2)}</div>
            
            {product.description && (
              <div className="quickview-description">
                <h3>Description</h3>
                <p>{product.description}</p>
              </div>
            )}
            
            <div className="quickview-quantity">
              <label>Quantity:</label>
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>
            
            <div className="quickview-actions">
              <button 
                className="quickview-add-btn"
                onClick={handleAddToCart}
                disabled={product.stockLevel === 0}
              >
                {product.stockLevel === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
            
            <div className="quickview-stock">
              {product.stockLevel > 0 ? (
                <span className="in-stock">✓ In Stock ({product.stockLevel} available)</span>
              ) : (
                <span className="out-of-stock">× Out of Stock</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}