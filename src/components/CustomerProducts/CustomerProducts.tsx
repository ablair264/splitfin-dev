// src/components/CustomerProducts/CustomerProducts.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, storage, auth } from '../../firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { FaSearch, FaShoppingCart, FaFilter, FaSort, FaCheck } from 'react-icons/fa';
import './CustomerProducts.css';
import { ProgressBar } from '../ProgressBar/ProgressBar';

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type?: string;
  category?: string[];
  price: number;
  imageUrl?: string;
  description?: string;
  stockLevel: number;
  item_id?: string;
  created_time?: string;
}

// Image URL cache - moved outside component to persist across renders
const imageUrlCache = new Map<string, string | null>();

// ProductCard component with true lazy loading
const ProductCard: React.FC<{ 
  product: Product; 
  onAddToOrder: (product: Product, quantity: number) => void;
}> = ({ product, onAddToOrder }) => {
  const [imageRef, setImageRef] = useState<HTMLDivElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [isAdded, setIsAdded] = useState(false);

  // Calculate if product is new (within 30 days)
  const isNew = useMemo(() => {
    if (!product.created_time) return false;
    
    const createdDate = new Date(product.created_time);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return createdDate > thirtyDaysAgo;
  }, [product.created_time]);

  // Function to fetch image URL
  const fetchImageUrl = useCallback(async () => {
    if (imageLoading || imageUrl !== null) return;
    
    setImageLoading(true);
    
    // Check cache first
    if (imageUrlCache.has(product.sku)) {
      setImageUrl(imageUrlCache.get(product.sku) || '');
      setImageLoading(false);
      return;
    }
    
    try {
      const extensions = ['.jpg', '.png', '.jpeg', '.webp'];
      
      for (const ext of extensions) {
        try {
          const imageRef = ref(storage, `product-images/${product.sku}${ext}`);
          const url = await getDownloadURL(imageRef);
          imageUrlCache.set(product.sku, url);
          setImageUrl(url);
          setImageLoading(false);
          return;
        } catch {
          continue;
        }
      }
      
      // No image found
      imageUrlCache.set(product.sku, null);
      setImageUrl('');
      setImageLoading(false);
    } catch (error) {
      imageUrlCache.set(product.sku, null);
      setImageUrl('');
      setImageLoading(false);
    }
  }, [product.sku, imageUrl, imageLoading]);

  useEffect(() => {
    if (!imageRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchImageUrl();
          observer.disconnect();
        }
      },
      { 
        threshold: 0.01,
        rootMargin: '200px' // Start loading 200px before entering viewport
      }
    );

    observer.observe(imageRef);

    return () => observer.disconnect();
  }, [imageRef, fetchImageUrl]);

  const handleAddToOrder = () => {
    const qtyInput = document.getElementById(`qty-${product.id}`) as HTMLInputElement;
    const quantity = parseInt(qtyInput.value) || 1;
    onAddToOrder(product, quantity);
    
    // Show success state
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="dmb-product-card">
      <div className="dmb-product-image" ref={setImageRef}>
        {/* Product badges */}
        <div className="dmb-product-badges">
          {isNew && <span className="dmb-badge dmb-badge-new">New</span>}
        </div>
        
        {imageUrl === null ? (
          <div className="dmb-image-placeholder">
            <div className="dmb-spinner"></div>
          </div>
        ) : imageUrl ? (
          <>
            {!imageLoaded && (
              <div className="dmb-image-placeholder">
                <div className="dmb-spinner"></div>
              </div>
            )}
            <img 
              src={imageUrl} 
              alt={product.name}
              onLoad={() => setImageLoaded(true)}
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
          </>
        ) : (
          <div className="dmb-image-placeholder">
            <span>No Image</span>
          </div>
        )}
        {product.stockLevel === 0 && (
          <div className="dmb-out-of-stock-overlay">Out of Stock</div>
        )}
      </div>
      
      <div className="dmb-product-details">
        <h3 className="dmb-product-name" title={product.name}>
          {product.name}
        </h3>
        <p className="dmb-product-sku">SKU: {product.sku}</p>
        <p className="dmb-product-price">£{(product.price || 0).toFixed(2)}</p>
        
        <div className="dmb-divider"></div>
        
        <div className="dmb-product-actions">
          <input
            type="number"
            min="1"
            defaultValue="1"
            className="dmb-quantity-input"
            id={`qty-${product.id}`}
            disabled={product.stockLevel === 0}
          />
          <button
            onClick={handleAddToOrder}
            className={`dmb-add-to-order-btn ${isAdded ? 'dmb-added' : ''}`}
            disabled={product.stockLevel === 0}
          >
            {isAdded ? (
              <>
                <FaCheck />
                <span>Added to order</span>
              </>
            ) : (
              <>
                <FaShoppingCart />
                <span>{product.stockLevel > 0 ? 'Add to Order' : 'Out of Stock'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CustomerProducts() {
  const { brandId } = useParams();
  const brandParam = brandId || '';
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showOrderNotification, setShowOrderNotification] = useState(false);
  const [hideOutOfStock, setHideOutOfStock] = useState(true);
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  const [zohoCustomerId, setZohoCustomerId] = useState<string | null>(null);

  // Get Zoho customer ID on mount
  useEffect(() => {
    getZohoCustomerId();
  }, []);

  const getZohoCustomerId = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const customerQuery = query(
        collection(db, 'customer_data'),
        where('firebase_uid', '==', user.uid)
      );
      const customerSnapshot = await getDocs(customerQuery);
      
      if (!customerSnapshot.empty) {
        const customerData = customerSnapshot.docs[0].data();
        const customerId = customerData.zoho_data?.customer_id || customerData.customer_id;
        setZohoCustomerId(customerId);
      }
    } catch (error) {
      console.error('Error getting Zoho customer ID:', error);
    }
  };

  // Load user's cart from Firebase on component mount
  useEffect(() => {
    loadUserCart();
  }, [zohoCustomerId]);

  const loadUserCart = async () => {
    const user = auth.currentUser;
    if (!user || !zohoCustomerId) return;

    try {
      // Check localStorage first
      const localCart = localStorage.getItem('customerOrder');
      
      if (!localCart || localCart === '[]') {
        // If local cart is empty, ensure Firebase cart is also empty
        await setDoc(doc(db, 'carts', zohoCustomerId), {
          items: [],
          updatedAt: new Date().toISOString(),
          customerId: zohoCustomerId,
          firebaseUid: user.uid
        });
        return;
      }

      // Otherwise load from Firebase using Zoho customer_id
      const cartDoc = await getDoc(doc(db, 'carts', zohoCustomerId));
      if (cartDoc.exists()) {
        const cartData = cartDoc.data();
        if (cartData.items && cartData.items.length > 0) {
          localStorage.setItem('customerOrder', JSON.stringify(cartData.items));
          window.dispatchEvent(new Event('orderUpdated'));
        }
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveUserCart = async (cartItems: any[]) => {
    const user = auth.currentUser;
    if (!user || !zohoCustomerId) return;

    try {
      // Save cart using Zoho customer_id
      await setDoc(doc(db, 'carts', zohoCustomerId), {
        items: cartItems,
        updatedAt: new Date().toISOString(),
        customerId: zohoCustomerId,
        firebaseUid: user.uid
      });
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const fetchProducts = async () => {
    console.log('Fetching products for brand:', brandParam);
    setLoading(true);
    
    try {
      // Handle special characters in brand names
      const normalizedBrand = brandParam.toLowerCase()
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ß/g, 'ss');
      
      // Create variations including the original with special characters
      const variations = [
        brandParam,
        brandParam.toLowerCase(),
        brandParam.charAt(0).toUpperCase() + brandParam.slice(1).toLowerCase(),
        brandParam.toUpperCase(),
        normalizedBrand,
        normalizedBrand.charAt(0).toUpperCase() + normalizedBrand.slice(1).toLowerCase(),
        brandParam.replace(/a/g, 'ä').toLowerCase(),
        brandParam.replace(/ae/g, 'ä').toLowerCase(),
        'räder',
        'Räder',
        'RÄDER',
        'rader',
        'Rader',
        'RADER'
      ];
      
      // Remove duplicates
      const uniqueVariations = [...new Set(variations)];
      
      let allProducts: Product[] = [];
      let foundProducts = false;
      
      // Check if this is Rader/Räder brand
      const isRaderBrand = normalizedBrand === 'rader' || brandParam.toLowerCase() === 'räder';
      
      // Try Manufacturer field first
      for (const variation of uniqueVariations) {
        console.log(`Trying variation: "${variation}"`);
        
        const manufacturerQuery = query(
          collection(db, 'items'),
          where('Manufacturer', '==', variation)
        );
        
        const snap = await getDocs(manufacturerQuery);
        
        if (!snap.empty) {
          console.log(`Found ${snap.size} products with Manufacturer="${variation}"`);
          
          // Create products WITHOUT fetching image URLs
          const productsWithoutImages = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              sku: data.sku || data.SKU || '',
              name: data.item_name || data.name || '',
              brand: data.Manufacturer || data.manufacturer || data.brand || '',
              type: data.type || '',
              category: data.category || [],
              price: data.rate || data.purchase_rate || 0,
              description: data.description || '',
              stockLevel: data.actual_available_stock || data.available_stock || data.stock_on_hand || 0,
              item_id: data.item_id,
              created_time: data.created_time || data.created_at || null
            } as Product;
          });
          
          allProducts = productsWithoutImages;
          foundProducts = true;
          break;
        }
      }
      
      // If still no products, try the brand field
      if (!foundProducts) {
        for (const variation of uniqueVariations) {
          const brandQuery = query(
            collection(db, 'items'),
            where('brand', '==', variation)
          );
          
          const snap = await getDocs(brandQuery);
          
          if (!snap.empty) {
            console.log(`Found ${snap.size} products with brand="${variation}"`);
            
            const productsWithoutImages = snap.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                sku: data.sku || data.SKU || '',
                name: data.item_name || data.name || '',
                brand: data.brand || data.Manufacturer || '',
                type: data.type || '',
                category: data.category || [],
                price: data.rate || data.purchase_rate || 0,
                description: data.description || '',
                stockLevel: data.actual_available_stock || data.available_stock || data.stock_on_hand || 0,
                item_id: data.item_id,
                created_time: data.created_time || data.created_at || null
              } as Product;
            });
            
            allProducts = productsWithoutImages;
            foundProducts = true;
            break;
          }
        }
      }
      
      // For Rader/Räder, also fetch all products where item_name starts with "Rader" or variations
      if (isRaderBrand) {
        console.log('Fetching additional Rader products by item_name...');
        
        const allItemsQuery = query(collection(db, 'items'));
        const allItemsSnap = await getDocs(allItemsQuery);
        
        const raderVariations = ['rader', 'räder', 'RADER', 'RÄDER', 'Rader', 'Räder'];
        
        const additionalProducts = allItemsSnap.docs
          .filter(doc => {
            const data = doc.data();
            const itemName = (data.item_name || data.name || '').trim();
            const firstWord = itemName.split(' ')[0].toLowerCase();
            
            return raderVariations.some(variation => 
              firstWord === variation.toLowerCase()
            );
          })
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              sku: data.sku || data.SKU || '',
              name: data.item_name || data.name || '',
              brand: data.Manufacturer || data.manufacturer || data.brand || 'Räder',
              type: data.type || '',
              category: data.category || [],
              price: data.rate || data.purchase_rate || 0,
              description: data.description || '',
              stockLevel: data.actual_available_stock || data.available_stock || data.stock_on_hand || 0,
              item_id: data.item_id,
              created_time: data.created_time || data.created_at || null
            } as Product;
          });
        
        console.log(`Found ${additionalProducts.length} additional Rader products by item_name`);
        
        const existingIds = new Set(allProducts.map(p => p.id));
        const uniqueAdditionalProducts = additionalProducts.filter(p => !existingIds.has(p.id));
        
        allProducts = [...allProducts, ...uniqueAdditionalProducts];
        foundProducts = true;
      }
      
      if (foundProducts && allProducts.length > 0) {
        // Set products WITHOUT image URLs - they'll be loaded on demand
        setProducts(allProducts);
      } else {
        console.log('No products found for any variation of:', brandParam);
      }
      
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandParam) {
      fetchProducts();
    }
  }, [brandParam]);

  const types = useMemo(() => {
    const typeSet = new Set(products.map(p => p.type).filter(t => t && t !== ''));
    return ['all', ...Array.from(typeSet).sort()];
  }, [products]);

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    products.forEach(product => {
      if (product.category && Array.isArray(product.category)) {
        product.category.forEach(cat => {
          if (cat) catSet.add(cat);
        });
      }
    });
    return ['all', ...Array.from(catSet).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesType = selectedType === 'all' || product.type === selectedType;
      const matchesCategory = selectedCategory === 'all' || 
        (product.category && Array.isArray(product.category) && 
         product.category.includes(selectedCategory));
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStock = !hideOutOfStock || product.stockLevel > 0;
      
      return matchesType && matchesCategory && matchesSearch && matchesStock;
    });

    if (sortBy === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [products, selectedType, selectedCategory, searchTerm, hideOutOfStock, sortBy]);

  const addToOrder = async (product: Product, quantity: number = 1) => {
    const existingOrder = JSON.parse(localStorage.getItem('customerOrder') || '[]');
    const existingItemIndex = existingOrder.findIndex((item: any) => item.product.id === product.id);
    
    if (existingItemIndex > -1) {
      existingOrder[existingItemIndex].quantity += quantity;
    } else {
      existingOrder.push({ product, quantity });
    }
    
    localStorage.setItem('customerOrder', JSON.stringify(existingOrder));
    
    // Save to Firebase for the current user
    await saveUserCart(existingOrder);
    
    setShowOrderNotification(true);
    setTimeout(() => setShowOrderNotification(false), 3000);
    
    window.dispatchEvent(new Event('orderUpdated'));
  };

  if (loading) {
    return (
      <div className="dmb-products-loading">
        <div className="dmb-spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  if (!brandParam) {
    return (
      <div className="dmb-products-empty">
        <p>Please select a brand to view products.</p>
      </div>
    );
  }

  if (products.length === 0 && !loading) {
    return (
      <div className="dmb-products-empty">
        <h2>No products found</h2>
        <p>No products available for {brandParam}.</p>
        <p>Please check back later or contact support.</p>
      </div>
    );
  }

  return (
    <div className="dmb-customer-products">
      <ProgressBar currentStep={2} />
      <div className="dmb-products-header">
        <h1>{brandParam.charAt(0).toUpperCase() + brandParam.slice(1)} Products</h1>
        <div className="dmb-products-controls">
          <div className="dmb-search-box">
            <FaSearch className="dmb-search-icon" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dmb-search-input"
            />
          </div>
          
          <div className="dmb-type-filter">
            <FaFilter className="dmb-filter-icon" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="dmb-type-select"
            >
              <option value="all">All Types</option>
              {types.slice(1).map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="dmb-category-filter">
            <FaFilter className="dmb-filter-icon" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="dmb-category-select"
            >
              <option value="all">All Categories</option>
              {categories.slice(1).map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="dmb-sort-filter">
            <FaSort className="dmb-sort-icon" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'none' | 'price-asc' | 'price-desc')}
              className="dmb-sort-select"
            >
              <option value="none">Sort by</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          <div className="dmb-stock-toggle">
            <label className="dmb-toggle-label">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(e) => setHideOutOfStock(e.target.checked)}
                className="dmb-toggle-checkbox"
              />
              <span className="dmb-toggle-slider"></span>
              <span className="dmb-toggle-text">Hide out of stock</span>
            </label>
          </div>
        </div>
      </div>

      <div className="dmb-products-info">
        <p>Showing {filteredProducts.length} of {products.length} products</p>
      </div>

      <div className="dmb-products-grid">
        {filteredProducts.map((product) => (
          <ProductCard 
            key={product.id} 
            product={product} 
            onAddToOrder={addToOrder}
          />
        ))}
      </div>

      {showOrderNotification && (
        <div className="dmb-order-notification">
          <FaShoppingCart />
          <span>Product added to order!</span>
        </div>
      )}
    </div>
  );
}