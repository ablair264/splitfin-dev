// src/components/CustomerOrders/CustomerOrders.tsx
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { 
  FaBox, 
  FaTruck, 
  FaCheckCircle, 
  FaClock, 
  FaFileAlt,
  FaMapMarkerAlt,
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
  FaSyncAlt
} from 'react-icons/fa';
import './CustomerOrders.css';

interface OrderItem {
  item_id: string;
  name: string;
  quantity: number;
  rate: number;
  total: number;
  sku?: string;
}

interface Order {
  salesorder_id: string;
  salesorder_number: string;
  date: string;
  total: number;
  status: string;
  line_items: OrderItem[];
  customer_id: string;
  customer_name: string;
  shipping_address?: string;
  delivery_date?: string;
  tracking_number?: string;
  shipment_date?: string;
  created_time?: string;
  last_modified_time?: string;
}

interface CustomerData {
  customer_id: string;
  customer_name?: string;
  email?: string;
  company_name?: string;
  firebase_uid: string;
}

interface TimelineStep {
  label: string;
  icon: React.ElementType;
  date?: string;
  active: boolean;
  completed: boolean;
}

export default function CustomerOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('all'); // all, pending, confirmed, delivered

  useEffect(() => {
    fetchCustomerAndOrders();
  }, []);

  const fetchCustomerAndOrders = async () => {
    try {
      setError(null);
      if (!auth.currentUser) {
        setError('Please log in to view orders');
        return;
      }

      // Fetch customer data using Firebase UID
      const customerDoc = await getDoc(doc(db, 'customer_data', auth.currentUser.uid));
      
      if (!customerDoc.exists()) {
        setError('Customer profile not found. Please contact support.');
        return;
      }

      const customerInfo = customerDoc.data() as CustomerData;
      setCustomerData(customerInfo);

      // Use customer_id to fetch orders from salesorders collection
      const ordersQuery = query(
        collection(db, 'salesorders'),
        where('customer_id', '==', customerInfo.customer_id),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(ordersQuery);
      const ordersList = snapshot.docs.map(doc => ({
        ...doc.data() as Order
      }));

      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCustomerAndOrders();
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const getOrderTimeline = (order: Order): TimelineStep[] => {
    const status = order.status?.toLowerCase() || '';
    const timeline: TimelineStep[] = [
      {
        label: 'Order Placed',
        icon: FaFileAlt,
        date: formatDate(order.date),
        active: true,
        completed: true
      },
      {
        label: 'Order Confirmed',
        icon: FaCheckCircle,
        date: status === 'confirmed' || status === 'packed' || status === 'shipped' || status === 'delivered' 
          ? formatDate(order.date) : undefined,
        active: status === 'confirmed',
        completed: status === 'confirmed' || status === 'packed' || status === 'shipped' || status === 'delivered'
      },
      {
        label: 'Packed & Ready',
        icon: FaBox,
        date: status === 'packed' || status === 'shipped' || status === 'delivered' 
          ? formatDate(order.shipment_date || order.date) : undefined,
        active: status === 'packed',
        completed: status === 'packed' || status === 'shipped' || status === 'delivered'
      },
      {
        label: 'Shipped',
        icon: FaTruck,
        date: order.shipment_date && (status === 'shipped' || status === 'delivered')
          ? formatDate(order.shipment_date) : undefined,
        active: status === 'shipped',
        completed: status === 'shipped' || status === 'delivered'
      },
      {
        label: 'Delivered',
        icon: FaCheckCircle,
        date: order.delivery_date && status === 'delivered' 
          ? formatDate(order.delivery_date) : undefined,
        active: status === 'delivered',
        completed: status === 'delivered'
      }
    ];

    return timeline;
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'draft':
      case 'pending':
        return 'pending';
      case 'confirmed':
        return 'confirmed';
      case 'packed':
        return 'packed';
      case 'shipped':
        return 'shipped';
      case 'delivered':
        return 'delivered';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `£${amount?.toFixed(2) || '0.00'}`;
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    const status = order.status?.toLowerCase() || '';
    if (filter === 'pending') return status === 'draft' || status === 'pending';
    if (filter === 'confirmed') return status === 'confirmed' || status === 'packed' || status === 'shipped';
    if (filter === 'delivered') return status === 'delivered';
    return true;
  });

  if (loading) {
    return (
      <div className="orders-loading">
        <div className="loading-spinner"></div>
        <p>Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-error">
        <FaExclamationTriangle className="error-icon" />
        <h3>Unable to Load Orders</h3>
        <p>{error}</p>
        <button onClick={fetchCustomerAndOrders} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="customer-orders">
      <div className="orders-header">
        <div className="header-content">
          <h1>My Orders</h1>
          {customerData && (
            <p className="customer-info">
              {customerData.company_name || customerData.customer_name}
            </p>
          )}
        </div>
        <div className="header-actions">
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <FaSyncAlt className={refreshing ? 'spinning' : ''} />
          </button>
          <div className="order-filters">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({orders.length})
            </button>
            <button 
              className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({orders.filter(o => ['draft', 'pending'].includes(o.status?.toLowerCase() || '')).length})
            </button>
            <button 
              className={`filter-btn ${filter === 'confirmed' ? 'active' : ''}`}
              onClick={() => setFilter('confirmed')}
            >
              In Progress ({orders.filter(o => ['confirmed', 'packed', 'shipped'].includes(o.status?.toLowerCase() || '')).length})
            </button>
            <button 
              className={`filter-btn ${filter === 'delivered' ? 'active' : ''}`}
              onClick={() => setFilter('delivered')}
            >
              Delivered ({orders.filter(o => o.status?.toLowerCase() === 'delivered').length})
            </button>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="empty-orders">
          <FaBox className="empty-icon" />
          <h3>No {filter !== 'all' ? filter : ''} orders found</h3>
          <p>
            {filter === 'all' 
              ? "You haven't placed any orders yet." 
              : `You don't have any ${filter} orders.`}
          </p>
          <button onClick={() => navigate('/customer/new-order')} className="start-order-btn">
            Start New Order
          </button>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const isExpanded = expandedOrders.has(order.salesorder_id);
            const timeline = getOrderTimeline(order);
            const currentStep = timeline.findIndex(step => step.active);
            
            return (
              <div key={order.salesorder_id} className="order-card">
                <div className="order-card-header">
                  <div className="order-main-info">
                    <h3>Order #{order.salesorder_number}</h3>
                    <p className="order-date">Placed on {formatDate(order.date)}</p>
                  </div>
                  <div className="order-header-right">
                    <span className={`order-status ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                    <button 
                      className="expand-btn"
                      onClick={() => toggleOrderExpansion(order.salesorder_id)}
                    >
                      {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                  </div>
                </div>

                {/* Timeline Progress */}
                <div className="order-timeline">
                  <div className="timeline-progress">
                    <div 
                      className="timeline-progress-bar"
                      style={{ width: `${(currentStep / (timeline.length - 1)) * 100}%` }}
                    />
                  </div>
                  <div className="timeline-steps">
                    {timeline.map((step, index) => (
                      <div 
                        key={index} 
                        className={`timeline-step ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}
                      >
                        <div className="timeline-icon">
                          <step.icon />
                        </div>
                        <div className="timeline-label">{step.label}</div>
                        {step.date && <div className="timeline-date">{step.date}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Summary */}
                <div className="order-summary">
                  <div className="summary-item">
                    <span className="summary-label">Items:</span>
                    <span className="summary-value">{order.line_items?.length || 0}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total:</span>
                    <span className="summary-value">{formatCurrency(order.total)}</span>
                  </div>
                  {order.tracking_number && (
                    <div className="summary-item">
                      <span className="summary-label">Tracking:</span>
                      <span className="summary-value tracking">{order.tracking_number}</span>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="order-expanded">
                    <div className="order-items">
                      <h4>Order Items</h4>
                      {order.line_items?.map((item, idx) => (
                        <div key={idx} className="order-item">
                          <div className="item-info">
                            <span className="item-name">{item.name}</span>
                            {item.sku && <span className="item-sku">SKU: {item.sku}</span>}
                          </div>
                          <div className="item-quantity">Qty: {item.quantity}</div>
                          <div className="item-price">{formatCurrency(item.total)}</div>
                        </div>
                      ))}
                    </div>

                    {order.shipping_address && (
                      <div className="order-shipping">
                        <h4><FaMapMarkerAlt /> Shipping Address</h4>
                        <p>{order.shipping_address}</p>
                      </div>
                    )}

                    <div className="order-actions">
                      <button 
                        className="view-details-btn"
                        onClick={() => navigate(`/customer/order/${order.salesorder_id}`)}
                      >
                        View Full Details
                      </button>
                      {order.status?.toLowerCase() === 'delivered' && (
                        <button className="reorder-btn">
                          Reorder Items
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}