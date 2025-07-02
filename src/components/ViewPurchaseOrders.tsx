import React, { useEffect, useState, useMemo } from 'react';
import { FaEye, FaCheckCircle, FaSearch } from 'react-icons/fa';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { auth } from '../firebase';
import './ViewPurchaseOrders.css';

interface PurchaseOrderLineItem {
  item_id: string;
  name: string;
  sku: string;
  quantity: number;
  quantity_received: number;
  quantity_billed?: number;
  rate: number;
  item_total: number;
  surplus?: boolean;
}

interface PurchaseOrder {
  purchaseorder_id: string;
  purchaseorder_number: string;
  vendor_id: string;
  vendor_name: string;
  status: string;
  date: string;
  delivery_date?: string;
  total: number;
  billed_status: string;
  received_status: string;
  line_items?: PurchaseOrderLineItem[];
  total_ordered_quantity?: number;
}

interface MarkReceivedModalProps {
  order: PurchaseOrder;
  onClose: () => void;
  onUpdate: () => void;
}

const MarkReceivedModal: React.FC<MarkReceivedModalProps> = ({ order, onClose, onUpdate }) => {
  const [items, setItems] = useState<PurchaseOrderLineItem[]>(order.line_items || []);
  
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.item_id === itemId
          ? { ...item, quantity_received: Math.min(newQuantity, item.quantity) }
          : item
      )
    );
  };
  
  const handleMarkAllReceived = () => {
    setItems(prevItems =>
      prevItems.map(item => ({ ...item, quantity_received: item.quantity }))
    );
  };
  
  const handleSave = () => {
    // Save the received quantities to the database
    console.log('Saving received quantities:', items);
    onUpdate();
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Mark Items as Received</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="po-info">
            <p><strong>Vendor:</strong> {order.vendor_name}</p>
            <p><strong>PO Number:</strong> {order.purchaseorder_number}</p>
          </div>
          
          <button className="mark-all-btn" onClick={handleMarkAllReceived}>
            Mark All as Received
          </button>
          
          <div className="items-list">
            {items.map(item => (
              <div key={item.item_id} className="item-row">
                <div className="item-info">
                  <h4>{item.name}</h4>
                  <p className="item-sku">SKU: {item.sku}</p>
                </div>
                <div className="quantity-controls">
                  <div className="quantity-info">
                    <span>Ordered: {item.quantity}</span>
                  </div>
                  <div className="received-input">
                    <label>Received:</label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={item.quantity_received || 0}
                      onChange={(e) => handleQuantityChange(item.item_id, parseInt(e.target.value) || 0)}
                      className="quantity-input"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ViewPurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [showMarkReceived, setShowMarkReceived] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      const currentUserId = auth.currentUser?.uid || localStorage.getItem('userId') || '';
      
      const response = await fetch(`${apiUrl}/api/reports/purchase-orders?dateRange=year&status=all&userId=${currentUserId}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Calculate total_ordered_quantity for each order
        const ordersWithQuantity = (result.data.purchaseorders || []).map((order: PurchaseOrder) => ({
          ...order,
          total_ordered_quantity: order.line_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
        }));
        setOrders(ordersWithQuantity);
      }
    } catch (err: any) {
      console.error('Error fetching purchase orders:', err);
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate metrics
  const metrics = useMemo(() => {
    const { startOfWeek, endOfWeek } = getThisWeekRange();
    
    // Items awaiting delivery
    const itemsAwaitingDelivery = orders.reduce((total, order) => {
      if (order.line_items) {
        const pending = order.line_items.reduce((sum, item) => 
          sum + (item.quantity - (item.quantity_received || 0)), 0
        );
        return total + pending;
      }
      return total;
    }, 0);
    
    // Items received this week (placeholder - would need actual received date data)
    const receivedThisWeek = 0; // This would need to be calculated from actual data
    
    // Items in surplus
    const itemsInSurplus = orders.reduce((total, order) => {
      if (order.line_items) {
        const surplus = order.line_items.filter(item => item.surplus).length;
        return total + surplus;
      }
      return total;
    }, 0);
    
    return {
      itemsAwaitingDelivery,
      receivedThisWeek,
      itemsInSurplus
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    
    const term = search.toLowerCase();
    return orders.filter(o =>
      o.vendor_name?.toLowerCase().includes(term) ||
      o.purchaseorder_number?.toLowerCase().includes(term)
    );
  }, [orders, search]);

  const getBrandLogo = (vendorName: string) => {
    const logoMap: { [key: string]: string } = {
      'Elvang Denmark': '/logos/elvang.png',
      'Relaxound GmbH': '/logos/relaxound.png',
      'Rader GmbH': '/logos/rader.png',
      'KF Design GmbH': '/logos/remember.png'
    };
    
    return logoMap[vendorName] || '/logos/default-brand.png';
  };

  const handleViewDetails = (order: PurchaseOrder) => {
    setSelectedOrder(order);
  };

  const handleMarkReceived = (order: PurchaseOrder) => {
    setShowMarkReceived(order);
  };

  if (loading) {
    return (
      <div className="orders-loading">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
        <p>Loading purchase orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h3>Error loading purchase orders</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="po-container">
      <div className="po-header">
        <h1>Purchase Orders</h1>
      </div>

      {/* Metric Cards */}
      <div className="po-metrics">
        <div className="metric-card">
          <div className="metric-value">{metrics.itemsAwaitingDelivery}</div>
          <div className="metric-label">Items Awaiting Delivery</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.receivedThisWeek}</div>
          <div className="metric-label">Received This Week</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.itemsInSurplus}</div>
          <div className="metric-label">Items in Surplus</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="po-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search purchase orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Purchase Orders List */}
      <div className="po-list-view">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No purchase orders found</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const logoUrl = getBrandLogo(order.vendor_name);
            
            return (
              <div key={order.purchaseorder_id} className="po-list-item">
                <div className="po-logo">
                  <img 
                    src={logoUrl} 
                    alt={order.vendor_name}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/logos/default-brand.png';
                    }}
                  />
                </div>

                <div className="po-info">
                  <div className="po-row">
                    <span className="po-label">Brand:</span>
                    <span className="po-value">{order.vendor_name}</span>
                  </div>
                  <div className="po-row">
                    <span className="po-label">PO Number:</span>
                    <span className="po-value">{order.purchaseorder_number}</span>
                  </div>
                  <div className="po-row">
                    <span className="po-label">Date Ordered:</span>
                    <span className="po-value">{new Date(order.date).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                <div className="po-details-section">
                  <div className="po-total">
                    <span className="po-label">Total of Items (£):</span>
                    <span className="po-amount">£{parseFloat(order.total.toString()).toFixed(2)}</span>
                  </div>
                  <div className="po-count">
                    <span className="po-label">Item Count:</span>
                    <span className="po-value">{order.total_ordered_quantity || 0}</span>
                  </div>
                  <div className={`status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {order.status}
                  </div>
                </div>

                <div className="po-actions">
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewDetails(order)}
                  >
                    <FaEye /> View Details
                  </button>
                  <button 
                    className="action-btn primary"
                    onClick={() => handleMarkReceived(order)}
                  >
                    <FaCheckCircle /> Mark Received
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showMarkReceived && (
        <MarkReceivedModal 
          order={showMarkReceived} 
          onClose={() => setShowMarkReceived(null)}
          onUpdate={fetchOrders}
        />
      )}
    </div>
  );
}