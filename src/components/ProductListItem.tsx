// src/components/ProductListItem.tsx
import React, { useState, useEffect, useRef } from 'react';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase';
import { Product } from './ProductCard';
import { imageUrlCache } from './imageCache'; // Import shared cache

interface ProductListItemProps {
  product: Product;
  quantity: number;
  isSelected: boolean;
  onQuantityChange: (qty: number) => void;
  onAddToOrder: () => void;
  onQuickView: () => void;
}

export function ProductListItem({
  product,
  quantity,
  isSelected,
  onQuantityChange,
  onAddToOrder,
  onQuickView
}: ProductListItemProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Check cache on mount
  useEffect(() => {
    const cachedUrl = imageUrlCache.get(product.sku);
    if (cachedUrl !== undefined) {
      setImageUrl(cachedUrl || '/placeholder.png');
    }
  }, [product.sku]);

  // Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.01, rootMargin: '100px' }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Fetch image when visible
  useEffect(() => {
    if (isVisible && imageUrl === null) {
      const fetchImage = async () => {
        const cachedUrl = imageUrlCache.get(product.sku);
        if (cachedUrl !== undefined) {
          setImageUrl(cachedUrl || '/placeholder.png');
          return;
        }

        try {
          const imageRef = storageRef(storage, `product-images/${product.sku}.png`);
          const url = await getDownloadURL(imageRef);
          imageUrlCache.set(product.sku, url);
          setImageUrl(url);
        } catch {
          try {
            const imageRef = storageRef(storage, `product-images/${product.sku}-1.png`);
            const url = await getDownloadURL(imageRef);
            imageUrlCache.set(product.sku, url);
            setImageUrl(url);
          } catch {
            imageUrlCache.set(product.sku, '');
            setImageUrl('/placeholder.png');
          }
        }
      };
      fetchImage();
    }
  }, [isVisible, imageUrl, product.sku]);

  return (
    <div ref={itemRef} className={`product-list-item ${isSelected ? 'selected' : ''}`}>
      <div className="product-list-image">
        <img 
          src={imageUrl || '/placeholder.png'} 
          alt={product.name}
          loading="lazy"
        />
      </div>
      
      <div className="product-list-info">
        <div className="product-list-details">
          <h3 className="product-list-title">{product.name}</h3>
          <div className="product-list-meta">
            <span>{product.sku}</span>
            <span>•</span>
            <span className={product.stockLevel > 0 ? 'in-stock' : 'back-order'}>
              {product.stockLevel > 0 ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
        </div>
        
        <div className="product-list-controls">
          <div className="product-list-price">£{product.retailPrice.toFixed(2)}</div>
          
          <div className="product-list-qty">
            <button
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={e => onQuantityChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <button onClick={() => onQuantityChange(quantity + 1)}>
              +
            </button>
          </div>
          
          <div className="product-list-actions">
            <button
              className={`product-card__btn product-card__btn--add ${isSelected ? 'added' : ''}`}
              onClick={onAddToOrder}
            >
              {isSelected ? '✔' : '+'}
            </button>
            <button
              className="product-card__btn product-card__btn--details"
              onClick={onQuickView}
            >
              👁
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}