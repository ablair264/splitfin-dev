// src/components/ReviewOrderPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createSalesOrder, type SalesOrderPayload, type SalesOrderLineItem } from '../api/zoho';
import FirebaseImage from './FirebaseImage';
import { FaRobot, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import './ReviewOrder.css';

// ============================================================
// INTERFACES
// ============================================================

interface Product {
  id: string;
  item_id?: string; // Zoho item ID
  name: string;
  sku: string;
  stockLevel: number;
  retailPrice: number;
  brand: string;
  brand_normalized: string;
  imageUrl?: string;
  description?: string;
  unit?: string;
}

interface LineItem {
  product: Product;
  qty: number;
  total: number;
}

interface Customer {
  id: string;
  name?: string;
  Primary_First_Name?: string;
  Primary_Last_Name?: string;
  Primary_Email?: string;
  Phone?: string;
  Billing_City?: string;
  Billing_Country?: string;
  Industry?: string;
  zohoInventoryId?: string; // This is the Zoho contact_id
  zohoCustID?: string;
  zohoContID?: string;
}

interface SuggestedProduct extends Product {
  reason?: string;
  confidence?: number;
}

interface OrderSubmissionResult {
  success: boolean;
  orderId?: string;
  zohoOrderId?: string;
  error?: string;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getCustomerDisplayName = (customer: Customer): string => {
  if (customer.name) return customer.name;
  
  const firstName = customer.Primary_First_Name || '';
  const lastName = customer.Primary_Last_Name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  return fullName || customer.Primary_Email || 'Unknown Customer';
};

const validateCustomerForOrder = (customer: Customer): { valid: boolean; error?: string } => {
  if (!customer.zohoInventoryId && !customer.zohoCustID) {
    return { 
      valid: false, 
      error: 'Customer is missing Zoho ID. Please sync customer data first.' 
    };
  }
  
  if (!customer.Primary_Email) {
    return { 
      valid: false, 
      error: 'Customer email is required for order processing.' 
    };
  }
  
  return { valid: true };
};

const validateOrderItems = (items: LineItem[]): { valid: boolean; error?: string } => {
  if (!items || items.length === 0) {
    return { valid: false, error: 'Order must contain at least one item.' };
  }
  
  const missingZohoIds = items.filter(item => !item.product.item_id);
  if (missingZohoIds.length > 0) {
    const skus = missingZohoIds.map(item => item.product.sku).join(', ');
    return { 
      valid: false, 
      error: `The following products are missing Zoho IDs: ${skus}. Please contact admin to sync inventory.` 
    };
  }
  
  return { valid: true };
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface CustomerSummaryProps {
  customer: Customer;
}

const CustomerSummary: React.FC<CustomerSummaryProps> = ({ customer }) => (
  <div className="customer-summary">
    <h3>Customer Information</h3>
    <div className="customer-details">
      <p><strong>Name:</strong> {getCustomerDisplayName(customer)}</p>
      <p><strong>Email:</strong> {customer.Primary_Email || 'N/A'}</p>
      <p><strong>Phone:</strong> {customer.Phone || 'N/A'}</p>
      <p><strong>City:</strong> {customer.Billing_City || 'N/A'}</p>
      <p><strong>Country:</strong> {customer.Billing_Country || 'N/A'}</p>
      <p><strong>Industry:</strong> {customer.Industry || 'N/A'}</p>
    </div>

    {process.env.NODE_ENV === 'development' && (
      <details className="debug-info">
        <summary>Debug Info</summary>
        <p>Firebase ID: {customer.id}</p>
        <p>Zoho Contact ID: {customer.zohoInventoryId || customer.zohoCustID || 'Missing'}</p>
        <p>Zoho Secondary ID: {customer.zohoContID || 'N/A'}</p>
      </details>
    )}
  </div>
);

interface OrderItemsTableProps {
  items: LineItem[];
  onQuantityChange?: (productId: string, newQty: number) => void;
  onRemoveItem?: (productId: string) => void;
  editable?: boolean;
}

const OrderItemsTable: React.FC<OrderItemsTableProps> = ({ 
  items, 
  onQuantityChange, 
  onRemoveItem,
  editable = false 
}) => (
  <div className="order-items-section">
    <h3>Order Items</h3>
    <table className="order-table">
      <thead>
        <tr>
          <th>Image</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
          {editable && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {items.map(({ product, qty, total }) => (
          <tr key={product.id}>
            <td>
              <div className="product-image">
                <FirebaseImage sku={product.sku} />
              </div>
            </td>
            <td>
              <div className="product-name">{product.name}</div>
            </td>
            <td className="product-sku">{product.sku}</td>
            <td>
              {editable && onQuantityChange ? (
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => onQuantityChange(product.id, parseInt(e.target.value, 10))}
                  className="qty-input"
                />
              ) : (
                qty
              )}
            </td>
            <td>£{product.retailPrice.toFixed(2)}</td>
            <td>£{total.toFixed(2)}</td>
            {editable && onRemoveItem && (
              <td>
                <button
                  className="remove-item-btn"
                  onClick={() => onRemoveItem(product.id)}
                  aria-label="Remove item"
                >
                  ×
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface AISuggestionsProps {
  suggestions: SuggestedProduct[];
  loading: boolean;
  onAddSuggestion: (product: SuggestedProduct) => void;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({ 
  suggestions, 
  loading, 
  onAddSuggestion 
}) => {
  if (suggestions.length === 0 && !loading) return null;

  return (
    <div className="ai-suggestions">
      <h3>
        <FaRobot className="ai-icon" />
        AI Recommended Products
      </h3>
      
      {loading ? (
        <div className="loading-suggestions">
          <FaSpinner className="spinner" />
          <span>Analyzing order patterns...</span>
        </div>
      ) : (
        <div className="suggested-products">
          {suggestions.map((product) => (
            <div key={product.id} className="suggested-product-card">
              <div className="suggested-product-image">
                <FirebaseImage sku={product.sku} />
              </div>
              <div className="suggested-product-info">
                <h4>{product.name}</h4>
                <p className="price">£{product.retailPrice.toFixed(2)}</p>
                {product.reason && (
                  <p className="reason">{product.reason}</p>
                )}
                {product.confidence && (
                  <div className="confidence-indicator">
                    <span>Confidence: {Math.round(product.confidence * 100)}%</span>
                  </div>
                )}
              </div>
              <button 
                className="add-suggestion-btn"
                onClick={() => onAddSuggestion(product)}
              >
                Add to Order
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ReviewOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [refreshedCustomer, setRefreshedCustomer] = useState<Customer | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedProduct[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [orderItems, setOrderItems] = useState<LineItem[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract state from navigation
  const { items: initialItems, orderTotal: initialTotal, brand, customer } = location.state as {
    items: LineItem[];
    orderTotal: number;
    brand: string;
    customer: Customer;
  } || {};

  // Initialize order items
  useEffect(() => {
    if (!initialItems || !customer) {
      navigate('/customers');
      return;
    }
    
    setOrderItems(initialItems);
    setOrderTotal(initialTotal);
  }, [initialItems, initialTotal, customer, navigate]);

  // Refresh customer data
  useEffect(() => {
    const fetchCustomerUpdates = async () => {
      if (!customer?.id) return;
      
      try {
        const docRef = doc(db, 'customer_data', customer.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const updatedData = docSnap.data();
          setRefreshedCustomer({
            ...customer,
            zohoInventoryId: updatedData.zohoInventoryId || 
                           updatedData.zoho_contact_id || 
                           customer.zohoInventoryId,
            zohoCustID: updatedData.zohoCustID || customer.zohoCustID,
            zohoContID: updatedData.zohoContID || customer.zohoContID,
          });
        }
      } catch (err) {
        console.warn('Could not refresh customer data:', err);
      }
    };

    fetchCustomerUpdates();
  }, [customer]);

  // Fetch AI suggestions
  const fetchAISuggestions = useCallback(async () => {
    if (!orderItems.length) return;
    
    setLoadingSuggestions(true);
    try {
      // TODO: Replace with actual AI endpoint
      const response = await fetch('/api/ai-insights/order-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          items: orderItems.map(item => ({
            sku: item.product.sku,
            quantity: item.qty,
            category: item.product.brand_normalized
          })),
          customerId: customer?.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      // Fallback to mock data for now
      setAiSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [orderItems, brand, customer]);

  useEffect(() => {
    fetchAISuggestions();
  }, [fetchAISuggestions]);

  // Calculate new total when items change
  const recalculateTotal = useCallback(() => {
    const newTotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    setOrderTotal(newTotal);
  }, [orderItems]);

  // Handle adding AI suggestion
  const handleAddSuggestion = (product: SuggestedProduct) => {
    const newItem: LineItem = {
      product,
      qty: 1,
      total: product.retailPrice
    };
    
    setOrderItems([...orderItems, newItem]);
    setAiSuggestions(aiSuggestions.filter(s => s.id !== product.id));
    recalculateTotal();
  };

  // Handle quantity change
  const handleQuantityChange = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    
    setOrderItems(items => 
      items.map(item => 
        item.product.id === productId
          ? { ...item, qty: newQty, total: newQty * item.product.retailPrice }
          : item
      )
    );
    recalculateTotal();
  };

  // Handle remove item
  const handleRemoveItem = (productId: string) => {
    setOrderItems(items => items.filter(item => item.product.id !== productId));
    recalculateTotal();
  };

  // Create Zoho sales order
  const createZohoOrder = async (
    customer: Customer,
    items: LineItem[]
  ): Promise<string> => {
    const zohoCustomerId = customer.zohoInventoryId || customer.zohoCustID;
    
    if (!zohoCustomerId) {
      throw new Error('Customer Zoho ID not found');
    }

    const payload: SalesOrderPayload = {
      customer_id: zohoCustomerId,
      reference_number: `WEB-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      line_items: items.map(({ product, qty }) => ({
        item_id: product.item_id || product.id,
        name: product.name,
        description: product.description || '',
        quantity: qty,
        rate: product.retailPrice,
        unit: product.unit || 'pcs'
      })),
      notes: `Order placed via ${brand} catalog`,
      custom_fields: [
        { field_id: 'cf_brand', value: brand },
        { field_id: 'cf_source', value: 'web_portal' }
      ]
    };

    const zohoOrder = await createSalesOrder(payload);
    return zohoOrder.salesorder_id;
  };

  // Submit order
  const handleSubmit = async () => {
    setError(null);
    const finalCustomer = refreshedCustomer || customer;
    
    // Validate customer
    const customerValidation = validateCustomerForOrder(finalCustomer);
    if (!customerValidation.valid) {
      setError(customerValidation.error!);
      return;
    }
    
    // Validate items
    const itemsValidation = validateOrderItems(orderItems);
    if (!itemsValidation.valid) {
      setError(itemsValidation.error!);
      return;
    }

    setSubmitting(true);
    
    try {
      // Save to Firebase first
      const orderData = {
        customerId: finalCustomer.id,
        customerName: getCustomerDisplayName(finalCustomer),
        customerEmail: finalCustomer.Primary_Email,
        brand,
        items: orderItems.map(({ product, qty, total }) => ({
          productId: product.id,
          zohoItemId: product.item_id,
          sku: product.sku,
          name: product.name,
          qty,
          price: product.retailPrice,
          total,
        })),
        orderTotal,
        status: 'pending',
        createdAt: Timestamp.now(),
        zohoCustomerId: finalCustomer.zohoInventoryId || finalCustomer.zohoCustID,
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      console.log('✅ Order saved to Firebase:', docRef.id);

      // Create Zoho sales order
      try {
        const zohoOrderId = await createZohoOrder(finalCustomer, orderItems);
        console.log('✅ Zoho order created:', zohoOrderId);
        
        // Update Firebase order with Zoho ID
        await addDoc(collection(db, 'orders', docRef.id, 'updates'), {
          zohoOrderId,
          status: 'submitted',
          updatedAt: Timestamp.now()
        });
      } catch (zohoError) {
        console.error('⚠️ Zoho submission failed:', zohoError);
        // Order is still saved in Firebase, can retry later
      }

      // Clear local storage
      localStorage.removeItem('SELECTED_CUSTOMER');
      localStorage.removeItem('ORDER_SELECTED');

      // Navigate to success page
      navigate('/order-success', { 
        state: { 
          orderId: docRef.id,
          orderTotal,
          customerName: getCustomerDisplayName(finalCustomer)
        }
      });
      
    } catch (error) {
      console.error('❌ Error submitting order:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  // Final customer data
  const finalCustomer = refreshedCustomer || customer;

  if (!finalCustomer || !orderItems.length) {
    return (
      <div className="review-order-page">
        <div className="error-state">
          <FaExclamationTriangle className="error-icon" />
          <h2>Missing Order Information</h2>
          <p>No customer or order items found. Please start a new order.</p>
          <button onClick={() => navigate('/customers')} className="btn btn-primary">
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review-order-page">
      <div className="page-header">
        <h1>Review Order</h1>
        <div className="order-summary">
          <span className="brand-badge">{brand}</span>
          <span className="total-amount">Total: £{orderTotal.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <FaExclamationTriangle />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">×</button>
        </div>
      )}

      <CustomerSummary customer={finalCustomer} />
      
      <OrderItemsTable 
        items={orderItems}
        onQuantityChange={handleQuantityChange}
        onRemoveItem={handleRemoveItem}
        editable={!submitting}
      />

      <AISuggestions
        suggestions={aiSuggestions}
        loading={loadingSuggestions}
        onAddSuggestion={handleAddSuggestion}
      />

      <div className="form-actions">
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          Back to Products
        </button>
        <button 
          className="btn btn-primary" 
          onClick={handleSubmit}
          disabled={submitting || orderItems.length === 0}
        >
          {submitting ? (
            <>
              <FaSpinner className="spinner" />
              <span>Submitting Order...</span>
            </>
          ) : (
            'Submit Order'
          )}
        </button>
      </div>
    </div>
  );
}