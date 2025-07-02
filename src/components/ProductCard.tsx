import React, { useState, useEffect, useCallback, memo } from 'react';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase';
import './allproducts.css';
import { FaCheck, FaPlus } from 'react-icons/fa';

interface Product {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  retailPrice: number;
  price: number;
  brand: string;
  brand_normalized: string;
  imageUrl?: string;
  creation_date?: string;
  created_at?: string;
  date_created?: string;
  modified_date?: string;
  updated_at?: string;
  last_modified?: string;
  [key: string]: any;
}

interface CardProps {
  product: Product;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onAddToOrder: () => void;
  isSelected: boolean;
  imageRoot: HTMLElement | null;
  children: React.ReactNode;
  style?: React.CSSProperties;
  showNewBadge?: boolean;
}

export type { Product };

const ProductCard = memo(({
  product,
  quantity,
  onQuantityChange,
  onAddToOrder,
  isSelected,
  imageRoot,
  children,
  style,
  showNewBadge = false,
}: CardProps) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);
  const [showAddedNotification, setShowAddedNotification] = useState(false);
  
  const inStock = product.stockLevel > 0;

// SIMPLE IMAGE LOADING with correct filename patterns
useEffect(() => {
  const loadImage = async () => {
    const brand = product.brand_normalized || 'remember';
    const originalSku = product.sku;
    const sku = product.sku.toLowerCase();
    
    // DEBUG: Let's see what we're working with
    console.log(`🔍 DEBUG - Original SKU: "${originalSku}"`);
    console.log(`🔍 DEBUG - Lowercase SKU: "${sku}"`);
    console.log(`🔍 DEBUG - Brand: "${brand}"`);
    console.log(`🔍 DEBUG - Product object:`, product);
    
    // Try different image numbers (1-10 to cover various ranges)
    const pathsToTry = [];
    
    // For each possible number, try different sizes (prefer larger, non-thumb)
    for (let i = 1; i <= 5; i++) { // Reduced to 5 for less spam
      pathsToTry.push(
        `brand-images/${brand}/${sku}_${i}.webp`,
        `brand-images/${brand}/${sku}_${i}_400x400.webp`,
      );
    }
    
    console.log(`🔍 Loading image for SKU: ${sku}, first few paths:`, pathsToTry.slice(0, 3));
    
    for (const path of pathsToTry) {
      try {
        console.log(`  Trying: ${path}`);
        const imageRef = storageRef(storage, path);
        const url = await getDownloadURL(imageRef);
        console.log(`  ✅ Found: ${path}`);
        setImageUrl(url);
        setImageLoading(false);
        return;
      } catch {
        continue;
      }
    }
    
    console.log(`  ❌ No image found for ${sku}`);
    setImageUrl('');
    setImageLoading(false);
  };

  loadImage();
}, [product.sku, product.brand_normalized]);

  const handleAddToOrder = useCallback(() => {
    onAddToOrder();
    if (!isSelected) {
      setShowAddedNotification(true);
      setTimeout(() => setShowAddedNotification(false), 3000);
    }
  }, [onAddToOrder, isSelected]);

  const handleQuantityChange = useCallback((newQty: number) => {
    onQuantityChange(Math.max(1, newQty));
  }, [onQuantityChange]);

  return (
    <>
      <div className={`product-card ${isSelected ? 'selected' : ''}`} style={style}>
        {/* New Badge */}
        {showNewBadge && (
          <div className="product-card__new-badge">
            New
          </div>
        )}

        <div className="product-card__image-container-square">
          <div className="product-card__image-wrapper-square">
            
            {imageLoading ? (
              <div className="image-skeleton">
                <div className="dmb-spinner"></div>
              </div>
            ) : imageUrl ? (
              <img 
                src={imageUrl}
                alt={product.name}
                className="product-card__image-img"
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            ) : (
              <div className="dmb-image-placeholder">
                <span>No Image</span>
              </div>
            )}
            
          </div>
        </div>

        <div className="product-card__body">
          <h3 className="product-card__title" title={product.name}>
            {product.name}
          </h3>

          <div className="product-card__meta">
            <span className="sku-value">{product.sku}</span>
          </div>

          <div className="product-card__price-display">
            <span className="currency-symbol">£</span>
            <span className="price-amount">{product.retailPrice.toFixed(2)}</span>
          </div>

          <div className="product-card__status">
            <span className={`status-indicator ${inStock ? 'in-stock' : 'back-order'}`}>
              ●
            </span>
            {inStock ? `${product.stockLevel} in stock` : 'Out of Stock'}
          </div>
          
          <div className="product-card__qty">
            <button
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
              type="button"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={e => handleQuantityChange(parseInt(e.target.value, 10) || 1)}
            />
            <button 
              onClick={() => handleQuantityChange(quantity + 1)}
              type="button"
            >
              +
            </button>
          </div>

          <div className="product-card__actions">
            <button
              className={`product-card__btn product-card__btn--add ${
                isSelected ? 'added' : ''
              }`}
              onClick={handleAddToOrder}
              type="button"
            >
              {isSelected ? <FaCheck /> : <FaPlus />}
              <span>{isSelected ? 'Added' : 'Add'}</span>
            </button>

            {children && React.isValidElement(children) && 
              React.cloneElement(children, {
                className: 'product-card__btn product-card__btn--details',
              } as any)
            }
          </div>
        </div>
      </div>

      {showAddedNotification && (
        <div className="notification-toast notification-success">
          <FaCheck />
          <span>Item added to order</span>
        </div>
      )}
    </>
  );
});

ProductCard.displayName = 'ProductCard';

export { ProductCard };