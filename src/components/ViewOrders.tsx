import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp, orderBy, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaUser, FaSearch, FaFileInvoice } from 'react-icons/fa';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import './ViewOrders.css';
import { useDashboard } from '../hooks/useDashboard';
import { NormalizedOrder } from '../types/dashboard';

interface CustomerData {
  firebase_uid: string;
  original_firebase_data?: any;
  zoho_data: {
    customer_name: string;
    company_name: string;
    email: string;
    phone: string;
    billing_address?: any;
    shipping_address?: any;
    cf_phone_number?: string;
  };
}

interface LineItem {
  id: string;
  item_name: string;
  name?: string;
  sku: string;
  quantity: number;
  price: number;
  rate?: number;
  total: number;
  item_total?: number;
}

interface OrderDetailsModalProps {
  order: NormalizedOrder;
  onClose: () => void;
}

const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose }) => {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    const fetchLineItems = async () => {
      try {
        const orderDoc = await getDoc(doc(db, 'salesorders', order.id));

        if (orderDoc.exists() && orderDoc.data().line_items) {
          const items = orderDoc.data().line_items.map((item: any, index: number) => ({
            id: `${order.id}_${index}`,
            item_name: item.name || item.item_name || 'Unknown Item',
            sku: item.sku || '',
            quantity: item.quantity || 0,
            price: item.rate || item.price || 0,
            total: item.item_total || item.total || (item.quantity * (item.rate || 0)) || 0
          }));
          setLineItems(items);
        }
      } catch (error) {
        console.error('Error fetching line items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchLineItems();
  }, [order.id]);

  return (
    <div className="order-modal-overlay" onClick={onClose}>
      <div className="order-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Order Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="order-info-grid">
            <div className="info-item">
              <span className="info-label">Order Number</span>
              <span className="info-value">{order.salesorder_number || order.order_number}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Customer</span>
              <span className="info-value">{order.customer_name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Order Date</span>
              <span className="info-value">{new Date(order.date || order.created_time).toLocaleDateString()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className={`status-badge ${order.status}`}>
                {order.status}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Total Amount</span>
              <span className="info-value">£{order.total?.toFixed(2)}</span>
            </div>
          </div>

          {lineItems.length > 0 && (
            <div className="line-items-section">
              <h3>Order Items</h3>
              <table className="line-items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index}>
                      <td>{item.item_name}</td>
                      <td>{item.quantity}</td>
                      <td>£{item.price.toFixed(2)}</td>
                      <td>£{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ViewOrders() {
  const [search, setSearch] = useState('');
  const [showMarketplaceOrders, setShowMarketplaceOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<NormalizedOrder | null>(null);
  const [customerDataMap, setCustomerDataMap] = useState<Record<string, CustomerData>>({});
  const navigate = useNavigate();

  const currentUserId = auth.currentUser?.uid;
  const { data, loading, error } = useDashboard({
    userId: currentUserId,
    dateRange: 'year',
    autoRefresh: false
  });

  const orders = data?.orders || [];

  // Fetch customer data for all orders
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (orders.length > 0) {
        try {
          // Get unique customer IDs
          const customerIds = [...new Set(orders.map(order => order.customer_id))];
          
          // Fetch customer data for each ID
          const customerPromises = customerIds.map(async (customerId) => {
            const customerQuery = query(
              collection(db, 'customer_data'), 
              where('firebase_uid', '==', customerId)
            );
            const snapshot = await getDocs(customerQuery);
            
            if (!snapshot.empty) {
              return {
                customerId,
                data: snapshot.docs[0].data() as CustomerData
              };
            }
            return null;
          });
          
          const customerResults = await Promise.all(customerPromises);
          const customerMap: Record<string, CustomerData> = {};
          
          customerResults.forEach(result => {
            if (result) {
              customerMap[result.customerId] = result.data;
            }
          });
          
          setCustomerDataMap(customerMap);
        } catch (error) {
          console.error('Error fetching customer data:', error);
        }
      }
    };
    
    fetchCustomerData();
  }, [orders]);

  // Calculate this week's date range
  const getThisWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek, endOfWeek };
  };

  // Filter orders based on marketplace toggle
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Apply marketplace filter
    if (!showMarketplaceOrders) {
      filtered = filtered.filter(order => order.customer_name !== 'Amazon UK - Customer');
    }
    
    // Apply search filter
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter((o) => {
        const customerData = customerDataMap[o.customer_id];
        const customerName = customerData?.zoho_data?.company_name || 
                           customerData?.zoho_data?.customer_name || 
                           o.customer_name || '';
        
        return customerName.toLowerCase().includes(term) ||
               (o.order_number || o.salesorder_number || '')?.toLowerCase().includes(term);
      });
    }
    
    return filtered;
  }, [orders, search, showMarketplaceOrders, customerDataMap]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const { startOfWeek, endOfWeek } = getThisWeekRange();
    
    // Filter orders for this week (excluding marketplace if toggle is off)
    const thisWeekOrders = filteredOrders.filter(order => {
      const orderDate = new Date(order.date || order.created_time);
      return orderDate >= startOfWeek && orderDate <= endOfWeek;
    });
    
    // Count deliveries this week
    const deliveriesThisWeek = filteredOrders.filter(order => {
      if (!order.shipment_date) return false;
      const shipDate = new Date(order.shipment_date);
      return shipDate >= startOfWeek && shipDate <= endOfWeek;
    });
    
    // Get top item from sales_transactions
    // This would need to be implemented with actual sales_transactions data
    const topItem = { name: 'Product ABC', count: 42 }; // Placeholder
    
    return {
      ordersThisWeek: thisWeekOrders.length,
      deliveriesThisWeek: deliveriesThisWeek.length,
      topItem: topItem
    };
  }, [filteredOrders]);

  const formatDate = (dateValue: any) => {
    try {
      if (!dateValue) return 'N/A';
      
      if (typeof dateValue === 'string') {
        return new Date(dateValue).toLocaleDateString('en-GB');
      }
      
      if (dateValue instanceof Date) {
        return dateValue.toLocaleDateString('en-GB');
      }
      
      return 'N/A';
    } catch {
      return 'Invalid Date';
    }
  };

  const getOrderLogo = (customerName: string) => {
    if (customerName === 'Amazon UK - Customer') {
      return '/logos/amazon.jpg';
    }
    return '/logos/dmb-logo.png';
  };

  const handleViewCustomer = (order: NormalizedOrder) => {
    navigate('/customers', { state: { customerId: order.customer_id } });
  };

  const handleViewOrder = (order: NormalizedOrder) => {
    navigate(`/order/${order.id}`);
  };

  const handleViewInvoice = (order: NormalizedOrder) => {
    // Navigate to invoice view or download invoice
    console.log('View invoice for order:', order.id);
  };

  if (loading) {
    return (
      <div className="all-orders-loading">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
        <p>Loading orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h3>Error loading orders</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h1>Orders</h1>
      </div>

      {/* Metric Cards */}
      <div className="orders-metrics">
        <div className="metric-card">
          <div className="metric-value">{metrics.ordersThisWeek}</div>
          <div className="metric-label">Orders This Week</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.deliveriesThisWeek}</div>
          <div className="metric-label">Deliveries This Week</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.topItem.count}</div>
          <div className="metric-label">Top Item</div>
          <div className="metric-sublabel">{metrics.topItem.name}</div>
        </div>
      </div>

      {/* Search and Toggle Bar */}
      <div className="orders-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toggle-wrapper">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showMarketplaceOrders}
              onChange={(e) => setShowMarketplaceOrders(e.target.checked)}
              className="toggle-input"
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">Show Marketplace Orders</span>
          </label>
        </div>
      </div>

      {/* Orders List */}
      <div className="orders-list-view">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No orders found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const customerData = customerDataMap[order.customer_id];
            const customerName = customerData?.zoho_data?.company_name || 
                               customerData?.zoho_data?.customer_name || 
                               order.customer_name;
            const logoUrl = getOrderLogo(order.customer_name);
            
            return (
              <div key={order.id} className="order-list-item">
                <div className="order-logo">
                  <img 
                    src={logoUrl} 
                    alt={customerName}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/logos/dmb-logo.png';
                    }}
                  />
                </div>

                <div className="order-info">
                  <div className="order-row">
                    <span className="order-label">SO Number:</span>
                    <span className="order-value">{order.salesorder_number || order.order_number || 'N/A'}</span>
                  </div>
                  <div className="order-row">
                    <span className="order-label">Customer:</span>
                    <span className="order-value">{customerName}</span>
                  </div>
                  <div className="order-row">
                    <span className="order-label">Date:</span>
                    <span className="order-value">{formatDate(order.date)}</span>
                  </div>
                </div>

                <div className="order-details-section">
                  <div className="order-total">
                    <span className="order-label">Order Total:</span>
                    <span className="order-amount">£{order.total?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="order-statuses">
                    <div className={`status-badge invoice-${order.invoiced_status || 'pending'}`}>
                      Invoice: {order.invoiced_status || 'Pending'}
                    </div>
                    <div className={`status-badge shipping-${order.shipped_status || 'pending'}`}>
                      Shipping: {order.shipped_status || 'Pending'}
                    </div>
                  </div>
                </div>

                <div className="order-actions">
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewCustomer(order)}
                  >
                    <FaUser /> View Customer
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewOrder(order)}
                  >
                    <FaEye /> View Order
                  </button>
                  <button 
                    className="action-btn primary"
                    onClick={() => handleViewInvoice(order)}
                  >
                    <FaFileInvoice /> View Invoice
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}
    </div>
  );
}