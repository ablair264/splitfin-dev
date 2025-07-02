import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore'
import { db, storage } from '../firebase'
import { ref, getDownloadURL } from 'firebase/storage'
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json'; 
import { ProductCard } from './ProductCard'
import QuickViewModal from './QuickViewModal'
import { FaSearch, FaTh, FaList, FaFilter, FaSort, FaTimes } from 'react-icons/fa';
import { ProgressBar } from './ProgressBar';
import './AllProducts.css'
import './dashboard.css'
import './ProductListItem.css'; // Add this line
import { ProductListItem } from './ProductListItem';

const LOADER_SRC =
  'https://lottie.host/83bc32e5-8bd1-468d-8dc6-8aae7c529ade/eEUoZnLTlp.lottie'

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Brand {
  name: string
  logoUrl?: string
}

interface AllProductsProps {
  preSelectedCustomer?: Customer;
}

interface Product {
  id: string
  name: string
  sku: string
  stockLevel: number
  retailPrice: number
  price: number
  brand: string
  brand_normalized: string
  customerIDs?: string[]
  imageUrl?: string
  compareAtPrice?: number
  item_id?: string
  category?: string
  type?: string
  pro_desc?: string
  images?: string[]
  status?: string
  creation_date?: string
  created_at?: string
  date_created?: string
  modified_date?: string
  updated_at?: string
  last_modified?: string
  [key: string]: any
}

interface LineItem {
  product: Product
  qty: number
  total: number
}

interface Customer {
  id: string
  name: string
  agentId: string
  [key: string]: any
}

// Skeleton Component
const ProductCardSkeleton = () => (
  <div className="product-card product-card-skeleton">
    <div className="product-card__image-container-square">
      <div className="skeleton-shimmer" />
    </div>
    <div className="product-card__body">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-sku" />
      <div className="skeleton-line skeleton-price" />
      <div className="skeleton-line skeleton-status" />
    </div>
  </div>
);

// Order Summary Modal Component
interface OrderSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: Array<{
    product: Product;
    quantity: number;
  }>;
  orderTotal: number;
  onRemoveItem: (productId: string) => void;
  onReviewOrder: () => void;
  onClearOrder: () => void;
}

const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  orderTotal,
  onRemoveItem,
  onReviewOrder,
  onClearOrder
}) => {
  if (!isOpen) return null;

  return (
    <div className="order-summary-modal-overlay" onClick={onClose}>
      <div className="order-summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="order-summary-header">
          <h3>Order Summary</h3>
          <button className="close-modal-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        <div className="selected-items-list">
          {selectedItems.length === 0 ? (
            <p className="no-items-message">No items in order yet</p>
          ) : (
            selectedItems.map(({ product, quantity }) => (
              <div key={product.id} className="selected-item">
                <div className="item-info">
                  <span className="item-name">{product.name}</span>
                  <span className="item-sku">{product.sku}</span>
                </div>
                <div className="item-quantity">
                  <span>{quantity} × £{product.price.toFixed(2)}</span>
                </div>
                <button
                  className="item-remove-btn"
                  onClick={() => onRemoveItem(product.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        
        <div className="order-summary-footer">
          <div className="order-total-large">
            Total: <strong>£{orderTotal.toFixed(2)}</strong>
          </div>
          <div className="order-actions">
            <button
              className="btn btn-primary"
              onClick={onReviewOrder}
              disabled={selectedItems.length === 0}
            >
              Review Order
            </button>
            <button
              className="btn btn-secondary"
              onClick={onClearOrder}
              disabled={selectedItems.length === 0}
            >
              Clear Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AllProducts() {
  const { customerId, brandID } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const gridWrapperRef = useRef<HTMLDivElement>(null)
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [visibleProducts, setVisibleProducts] = useState(12);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [isSlowDevice, setIsSlowDevice] = useState(false);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Modify selected state to include customer ID
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  
  const [products, setProducts] = useState<Product[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [showModal, setShowModal] = useState(false)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isSalesAgent = user.role === 'salesAgent'

  // 🔍 DEBUGGING CODE - Add this AFTER products state is defined
  useEffect(() => {
    if (products.length > 0) {
      console.log('🔍 DEBUGGING - First product data:', {
        sku: products[0].sku,
        brand: products[0].brand,
        brand_normalized: products[0].brand_normalized,
        name: products[0].name
      });
      
      console.log('🔍 DEBUGGING - All products sample:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`  Product ${i + 1}:`, {
          sku: p.sku,
          brand: p.brand,
          name: p.name.substring(0, 30) + '...'
        });
      });
    }
  }, [products]);

  // Device performance detection
  useEffect(() => {
    const detectPerformance = () => {
      const connection = (navigator as any).connection;
      const isSlowConnection = connection?.effectiveType === 'slow-2g' || 
                              connection?.effectiveType === '2g' ||
                              connection?.effectiveType === '3g';
      const isLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
      const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
      
      setIsSlowDevice(isSlowConnection || isLowMemory || isLowEndDevice);
    };

    detectPerformance();
  }, []);

  // Performance monitoring
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 16) {
            console.warn('Long task detected:', entry.duration);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Ignore if longtask is not supported
      }
      
      return () => observer.disconnect();
    }
  }, []);

  // Adjust load increment based on device
  const loadIncrement = isSlowDevice ? 8 : 20;

  // FIXED: Clear selections when brand changes
  useEffect(() => {
    if (brandID && selectedCustomer) {
      const brandKey = `LAST_BRAND_${selectedCustomer.id}`;
      const lastBrand = localStorage.getItem(brandKey);
      
      if (lastBrand && lastBrand !== brandID) {
        // Brand has changed, clear ALL order data
        setSelected({});
        setQuantities({});
        
        // Clear all order-related localStorage items for this customer
        const storageKey = `ORDER_SELECTED_${selectedCustomer.id}`;
        localStorage.removeItem(storageKey);
        
        // Also clear any quantity data if stored separately
        localStorage.removeItem(`ORDER_QUANTITIES_${selectedCustomer.id}`);
      }
      
      // Update the last brand
      localStorage.setItem(brandKey, brandID);
    }
  }, [brandID, selectedCustomer]);

  // FIXED: Clear selections if navigating fresh (not from order summary)
  useEffect(() => {
    if (!location.state?.preserveSelections) {
      setSelected({});
      setQuantities({});
    }
  }, [location.state]);

  // Load selected items from localStorage with customer ID
  useEffect(() => {
    if (selectedCustomer) {
      const storageKey = `ORDER_SELECTED_${selectedCustomer.id}`;
      try {
        const stored = localStorage.getItem(storageKey);
        setSelected(stored ? JSON.parse(stored) : {});
      } catch {
        setSelected({});
      }
    }
  }, [selectedCustomer]);

  // Batched localStorage updates
  useEffect(() => {
    if (selectedCustomer) {
      const timeoutId = setTimeout(() => {
        const storageKey = `ORDER_SELECTED_${selectedCustomer.id}`;
        localStorage.setItem(storageKey, JSON.stringify(selected));
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [selected, selectedCustomer]);

  const brandDoc = useMemo(() => {
    if (products.length === 0) return null
    const { brand, brand_normalized } = products[0]
    return {
      name: brand,
      brand_normalized,
      logoUrl: `/logos/${brand_normalized}.png`,
    }
  }, [products])

  useEffect(() => {
    setLoading(true)
    if (!brandID) return
    ;(async () => {
      try {
        // First, let's try to find items by manufacturer
        const manufacturerQuery = query(
          collection(db, 'items'),
          where('Manufacturer', '==', brandID)
        )

        let snap = await getDocs(manufacturerQuery)
        
        // If no results, try case-insensitive variations
        if (snap.empty) {
          const variations = [
            brandID.toLowerCase(),
            brandID.charAt(0).toUpperCase() + brandID.slice(1).toLowerCase(),
            brandID.toUpperCase()
          ]
          
          for (const variation of variations) {
            const q = query(
              collection(db, 'items'),
              where('Manufacturer', '==', variation)
            )
            snap = await getDocs(q)
            if (!snap.empty) break
          }
        }

        // If still no results, try manufacturer field (lowercase)
        if (snap.empty) {
          const q = query(
            collection(db, 'items'),
            where('manufacturer', '==', brandID.toLowerCase())
          )
          snap = await getDocs(q)
        }

        const items: Product[] = []
        const qInit: Record<string, number> = {}
        const uniqueCategories = new Set<string>()
        const uniqueTypes = new Set<string>()

        // Process documents WITHOUT fetching images
        snap.docs.forEach((d) => {
          const data = d.data()
          
          // Add this check for status
          if (data.status === 'inactive') {
            return; // Skip inactive products
          }
          
          const manufacturer = data.Manufacturer || data.manufacturer || ''
          const brandNormalized = manufacturer.toLowerCase().replace(/\s+/g, '-')
          
          if (brandNormalized === brandID.toLowerCase() || 
              manufacturer.toLowerCase() === brandID.toLowerCase()) {
            
            const item: Product = {
              id: d.id,
              name: data.item_name || data.name || '',
              sku: data.sku || '',
              stockLevel: data.available_stock || data.actual_available_stock || data.stock_on_hand || 0,
              retailPrice: data.rate || data.selling_price || 0,
              price: data.rate || data.selling_price || 0,
              brand: manufacturer,
              brand_normalized: brandNormalized,
              imageUrl: null,
              images: [],
              compareAtPrice: data.compare_at_price || data.compareAtPrice,
              item_id: data.item_id,
              category: data.category || '',
              type: data.type || '',
              pro_desc: data.pro_desc || '',
              status: data.status || 'active'
            }
            
            items.push(item)
            qInit[d.id] = 1
            
            if (data.category) uniqueCategories.add(data.category)
            if (data.type) uniqueTypes.add(data.type)
          }
        })
        
        console.log(`Found ${items.length} items for brand ${brandID}`)
        
        setProducts(items)
        setQuantities(qInit)
        setCategories(Array.from(uniqueCategories).sort())
        setTypes(Array.from(uniqueTypes).sort())
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [brandID])
  
  // Helper function to check if product is new (within last 30 days)
  const isNewProduct = useCallback((product: Product) => {
    // Method 1: Check if product was added in last 30 days based on creation date
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    // Check various possible date fields
    const creationDate = product.creation_date || product.created_at || product.date_created
    const modifiedDate = product.modified_date || product.updated_at || product.last_modified
    
    if (creationDate) {
      return new Date(creationDate) > thirtyDaysAgo
    }
    if (modifiedDate) {
      return new Date(modifiedDate) > thirtyDaysAgo
    }
    
    // Method 2: Fallback - consider first 20% of sorted products as "new"
    const sortedProducts = [...products].sort((a, b) => b.id.localeCompare(a.id))
    const newProductsCount = Math.ceil(sortedProducts.length * 0.2) // Top 20%
    const isInTop20Percent = sortedProducts.slice(0, newProductsCount).some(p => p.id === product.id)
    
    return isInTop20Percent
  }, [products])

  // Customer fetching logic
  useEffect(() => {
    if (location.state?.selectedCustomer) {
      setSelectedCustomer(location.state.selectedCustomer)
      return
    }

    if (customerId) {
      const fetchCustomer = async () => {
        try {
          const docRef = doc(db, 'customers', customerId)
          const snap = await getDoc(docRef)
          if (snap.exists()) {
            const data = snap.data()
            const normalizedCustomer: Customer = {
              id: snap.id,
              ...data,
              name: data.company_name || data.customer_name || 
                `${data.Primary_First_Name || ''} ${data.Primary_Last_Name || ''}`.trim(),
              agentId: data.agentId || '',
            }
            setSelectedCustomer(normalizedCustomer)
            localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(normalizedCustomer))
          } else {
            setShowModal(true)
          }
        } catch (err) {
          console.error('Error fetching customer:', err)
          setShowModal(true)
        }
      }
      fetchCustomer()
      return
    }

    const stored = localStorage.getItem('SELECTED_CUSTOMER')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) {
          setSelectedCustomer(parsed)
          return
        }
      } catch {
        // ignore parse error
      }
    }

    setShowModal(true)
  }, [location.state, customerId])

  useEffect(() => {
    if (!isSalesAgent) return

    const fetchCustomers = async () => {
      const snap = await getDocs(collection(db, 'customers'))
      const customers = snap.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          name: data.company_name || data.customer_name ||
            `${data.Primary_First_Name || ''} ${data.Primary_Last_Name || ''}`.trim(),
          agentId: data.agentId || '',
        }
      })

      const filtered = customers.filter(c => c.agentId === user.zohoAgentID)
      setAllCustomers(filtered)
    }

    fetchCustomers()
  }, [user])

  // Enhanced filtering with debounced search and sorting
  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    
    let result = products.filter((p) =>
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    )
    
    // Stock filter
    if (hideOutOfStock) {
      result = result.filter(p => p.stockLevel > 0)
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory)
    }
    
    // Type filter
    if (selectedType !== 'all') {
      result = result.filter(p => p.type === selectedType)
    }
    
    // FIXED: Default sorting by newest first (by product ID as proxy for creation order)
    if (sortBy === 'none') {
      // Sort by ID in descending order (newest IDs first)
      result.sort((a, b) => b.id.localeCompare(a.id))
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price)
    }
    
    return result
  }, [products, debouncedSearch, hideOutOfStock, selectedCategory, selectedType, sortBy])

  // Optimized infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleProducts < filtered.length) {
          setVisibleProducts(prev => Math.min(prev + loadIncrement, filtered.length))
        }
      },
      { 
        threshold: 0.1,
        rootMargin: isSlowDevice ? '50px' : '100px'
      }
    )

    observerRef.current.observe(loadMoreRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [filtered.length, visibleProducts, loadIncrement, isSlowDevice])

  // Reset visible products when filters change
  useEffect(() => {
    setVisibleProducts(isSlowDevice ? 8 : 12)
  }, [debouncedSearch, hideOutOfStock, selectedCategory, selectedType, sortBy, isSlowDevice])

  const selectedTotal = useMemo(() => {
    return filtered.reduce((sum, p) => {
      if (!selected[p.id]) return sum
      return sum + p.price * (quantities[p.id] || 1)
    }, 0)
  }, [filtered, selected, quantities])

  // Optimized callbacks
  const handleQtyChange = useCallback((id: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [id]: qty }))
  }, [])

  const handleAddToOrder = useCallback((prod: Product) => {
    setSelected((prev) => ({ ...prev, [prod.id]: !prev[prod.id] }))
  }, [])

  const handleClearOrder = useCallback(() => {
    setSelected({})
    setQuantities({})
  }, [])

  const handleReviewOrder = useCallback(() => {
    const itemsToReview: LineItem[] = filtered
      .filter((p) => selected[p.id])
      .map((p) => ({
        product: p,
        qty: quantities[p.id] || 1,
        total: p.price * (quantities[p.id] || 1),
      }))
    navigate('/order-summary', {
      state: {
        items: itemsToReview,
        orderTotal: selectedTotal,
        brand: brandDoc?.name || '',
        customer: selectedCustomer || null,
      },
    })
  }, [filtered, selected, quantities, selectedTotal, brandDoc, selectedCustomer, navigate])

  if (loading) {
    return (
      <div className="ai-loading">
        <div className="ai-loading-lottie">
          <Lottie 
            animationData={loaderAnimation}
            loop={true}
            autoplay={true}
            style={{ width: 100, height: 100 }}
          />
        </div>
        <p>Loading..</p>
      </div>
    )
  }

  return (
    <div className="allproducts-page">
      {!selectedCustomer && showModal && (
        <div className="customer-picker-modal">
          <div className="modal-content">
            <h2>Select a Customer</h2>
            <select
              onChange={(e) => {
                const selectedId = e.target.value;
                const customer = allCustomers.find((c) => c.id === selectedId);
                if (customer) {
                  localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customer));
                  setSelectedCustomer(customer);
                  setShowModal(false);
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Select a customer...</option>
              {allCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {brandID && brandDoc && (
        <div className="brand-header">
          {brandDoc.logoUrl && (
            <img src={brandDoc.logoUrl} alt={brandDoc.name} className="brand-logo" />
          )}
        </div>
      )}
      
      <div className="progress-bar-container">
        <ProgressBar currentStep={2} theme="dark" />
      </div>

      <div className="top-bar">
        <div className="top-bar-controls">
          {/* Search */}
          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              className="search-input"
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Types Filter */}
          {types.length > 0 && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          )}
          
          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="none">Sort by</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
          
          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              <FaTh />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              <FaList />
            </button>
          </div>
          
          {/* Stock Toggle */}
          <div className="filter-group">
            <button
              className={`custom-toggle ${!hideOutOfStock ? 'active' : ''}`}
              onClick={() => setHideOutOfStock(!hideOutOfStock)}
              aria-label="Toggle out of stock visibility"
            >
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </button>
            <span className="toggle-label">Show out of stock</span>
          </div>
        </div>

        {/* Order Summary - Now part of the top bar */}
        <div className="order-summary" onClick={() => setShowOrderModal(true)}>
          <span className="order-total">
            Total: <strong>£{selectedTotal.toFixed(2)}</strong>
            <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'rgba(255, 255, 255, 0.5)' }}>
              ({Object.values(selected).filter(Boolean).length} items)
            </span>
          </span>
          <div className="order-summary-buttons">
            <button
              className="btn review-order-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleReviewOrder();
              }}
              disabled={selectedTotal === 0}
            >
              Review Order
            </button>
            <button
              className="btn-outline-secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleClearOrder();
              }}
              disabled={selectedTotal === 0}
            >
              Clear Order
            </button>
          </div>
        </div>
      </div>

      <div className="allproducts-grid-wrapper" ref={gridWrapperRef}>
        {viewMode === 'grid' ? (
          <>
            <div className="allproducts-grid">
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              ) : (
                filtered.slice(0, visibleProducts).map((p, index) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    quantity={quantities[p.id] || 1}
                    onQuantityChange={(q) => handleQtyChange(p.id, q)}
                    onAddToOrder={() => handleAddToOrder(p)}
                    isSelected={!!selected[p.id]}
                    imageRoot={gridWrapperRef.current}
                    style={{ '--animation-order': index } as React.CSSProperties}
                    showNewBadge={isNewProduct(p)}
                  >
                    <button
                      className="btn btn-sm btn-info mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewProduct(p);
                      }}
                    >
                      Details
                    </button>
                  </ProductCard>
                ))
              )}
            </div>
            {visibleProducts < filtered.length && (
              <div ref={loadMoreRef} className="load-more-trigger" />
            )}
          </>
        ) : (
          <>
            <div className="allproducts-list">
              {filtered.slice(0, visibleProducts).map((p) => (
                <ProductListItem
                  key={p.id}
                  product={p}
                  quantity={quantities[p.id] || 1}
                  isSelected={!!selected[p.id]}
                  onQuantityChange={(q) => handleQtyChange(p.id, q)}
                  onAddToOrder={() => handleAddToOrder(p)}
                  onQuickView={() => setQuickViewProduct(p)}
                />
              ))}
            </div>
            {visibleProducts < filtered.length && (
              <div ref={loadMoreRef} className="load-more-trigger" />
            )}
          </>
        )}
      </div>

      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          quantity={quantities[quickViewProduct.id] || 1}
          onQuantityChange={(q) => handleQtyChange(quickViewProduct.id, q)}
          onAddToOrder={() => handleAddToOrder(quickViewProduct)}
          onClose={() => setQuickViewProduct(null)}
        />
      )}

      <OrderSummaryModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        selectedItems={filtered
          .filter((p) => selected[p.id])
          .map((p) => ({
            product: p,
            quantity: quantities[p.id] || 1
          }))}
        orderTotal={selectedTotal}
        onRemoveItem={(productId) => {
          setSelected(prev => ({ ...prev, [productId]: false }));
        }}
        onReviewOrder={() => {
          setShowOrderModal(false);
          handleReviewOrder();
        }}
        onClearOrder={() => {
          handleClearOrder();
          setShowOrderModal(false);
        }}
      />
    </div>
  )
}