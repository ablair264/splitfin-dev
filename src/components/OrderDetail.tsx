import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  FaArrowLeft, FaFileInvoice, FaUser, FaTruck, 
  FaBox, FaCalendar, FaClock, FaMoneyBillWave,
  FaAmazon, FaStore, FaCheckCircle, FaExclamationTriangle
} from 'react-icons/fa';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import './OrderDetail.css';

interface CustomerData {
  firebase_uid: string;
  original_firebase_data?: any;
  zoho_data: {
    customer_name: string;
    company_name: string;
    email: string;
    phone: string;
    cf_phone_number?: string;
    billing_address?: any;
    shipping_address?: any;
  };
}

interface OrderData {
  salesorder_id: string;
  salesorder_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  created_time: string;
  delivery_date?: string;
  shipment_date?: string;
  total: number;
  balance: number;
  status: string;
  order_status: string;
  paid_status: string;
  invoiced_status: string;
  shipped_status: string;
  reference_number: string;
  currency_code: string;
  currency_symbol: string;
  quantity: number;
  quantity_invoiced: number;
  quantity_packed: number;
  quantity_shipped: number;
  is_marketplace_order: boolean;
  marketplace_source?: string;
  sales_channel?: string;
  branch_name: string;
  email?: string;
  salesperson_name?: string;
  billing_address?: any;
  shipping_address?: any;
  line_items?: any[];
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

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerData | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'shipping' | 'financial'>('overview');

  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    }
  }, [orderId]);

  useEffect(() => {
    if (orderData) {
      fetchInvoiceData();
      if (orderData.customer_id) {
        fetchCustomerDetails(orderData.customer_id);
      }
    }
  }, [orderData]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const orderDoc = await getDoc(doc(db, 'salesorders', orderId));
      
      if (orderDoc.exists()) {
        const data = orderDoc.data() as OrderData;
        setOrderData(data);
        
        // Extract and process line items
        if (data.line_items) {
          const items = data.line_items.map((item: any, index: number) => ({
            id: `${orderId}_${index}`,
            item_name: item.name || item.item_name || 'Unknown Item',
            sku: item.sku || '',
            quantity: item.quantity || 0,
            price: item.rate || item.price || 0,
            total: item.item_total || item.total || (item.quantity * (item.rate || 0)) || 0
          }));
          setLineItems(items);
        }
        setLoadingItems(false);
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetails = async (customerId: string) => {
    try {
      const customerQuery = query(
        collection(db, 'customer_data'), 
        where('firebase_uid', '==', customerId)
      );
      const snapshot = await getDocs(customerQuery);
      
      if (!snapshot.empty) {
        setCustomerDetails(snapshot.docs[0].data() as CustomerData);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    }
  };

  const fetchInvoiceData = async () => {
    try {
      // Fetch related invoice if exists
      const invoicesQuery = query(
        collection(db, 'invoice_data'),
        where('reference_number', '==', orderData?.salesorder_number || '')
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      if (!invoicesSnapshot.empty) {
        setInvoiceData(invoicesSnapshot.docs[0].data());
      }
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    }
  };

  // Helper functions
  const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return '£0.00';
    }
    return `£${value.toFixed(2)}`;
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      return new Date(dateValue).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  const calculateDaysOverdue = () => {
    if (!orderData?.date || orderData.paid_status === 'paid') return 0;
    
    const orderDate = new Date(orderData.date);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - orderDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 30 ? diffDays - 30 : 0; // Assuming 30 day payment terms
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (['completed', 'paid', 'shipped', 'fulfilled', 'closed'].includes(statusLower)) return 'green';
    if (['pending', 'processing', 'packed', 'invoiced'].includes(statusLower)) return 'yellow';
    if (['cancelled', 'overdue'].includes(statusLower)) return 'red';
    return 'gray';
  };

  const getFulfillmentRate = () => {
    if (!orderData?.quantity) return 0;
    return ((orderData.quantity_shipped || 0) / orderData.quantity) * 100;
  };

  // Calculate total items from line items
  const getTotalItemsCount = () => {
    return lineItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (loading) {
    return (
      <div className="order-detail-loading">
        <Lottie animationData={loaderAnimation} style={{ width: 100, height: 100 }} />
        <p>Loading order details...</p>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="order-detail-error">
        <h2>Order not found</h2>
        <button onClick={() => navigate('/orders')} className="btn btn-primary">
          Back to Orders
        </button>
      </div>
    );
  }

  const daysOverdue = calculateDaysOverdue();
  const fulfillmentRate = getFulfillmentRate();
  const totalItemsCount = getTotalItemsCount();
  const customerName = customerDetails?.zoho_data?.company_name || 
                      customerDetails?.zoho_data?.customer_name || 
                      orderData.customer_name;

  return (
    <div className="order-detail-container">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/orders')}>
          <FaArrowLeft /> Back to Orders
        </button>
        
        <div className="header-info">
          <h1>Order #{orderData.salesorder_number}</h1>
          <div className="header-badges">
            <span className={`status-badge ${getStatusColor(orderData.status)}`}>
              {orderData.status}
            </span>
            {orderData.is_marketplace_order && (
              <span className="marketplace-badge">
                <FaAmazon /> {orderData.marketplace_source}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate(`/customer/${orderData.customer_id}`)}
          >
            <FaUser /> View Customer
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => navigate(`/invoice/${invoiceData?.invoice_id || orderId}`)}
          >
            <FaFileInvoice /> View Invoice
          </button>
        </div>
      </div>

      {/* Order Summary Cards */}
      <div className="order-summary-cards">
        <div className="ordview-summary-card">
          <div className="card-metric">
            <h3>Order Value</h3>
            <div className="metric-value">{formatCurrency(orderData.total)}</div>
            <p className="metric-label">
              Balance: {formatCurrency(orderData.balance)}
            </p>
          </div>
        </div>

        <div className="ordview-summary-card">
          <div className="card-metric">
            <h3>Payment Status</h3>
            <div className={`status-indicator ${getStatusColor(orderData.paid_status)}`}>
              {orderData.paid_status === 'paid' ? (
                <>
                  <FaCheckCircle /> Paid
                </>
              ) : (
                <>
                  <FaExclamationTriangle /> Unpaid
                </>
              )}
            </div>
            {daysOverdue > 0 && (
              <p className="overdue-warning">{daysOverdue} days overdue</p>
            )}
          </div>
        </div>

        <div className="ordview-summary-card">
          <div className="card-metric">
            <h3>Fulfillment</h3>
            <div className="fulfillment-bar">
              <div 
                className="fulfillment-progress"
                style={{ width: `${fulfillmentRate}%` }}
              />
            </div>
            <p className="metric-label">
              {orderData.quantity_shipped || 0} of {totalItemsCount || orderData.quantity || 0} items shipped
            </p>
          </div>
        </div>

        <div className="ordview-summary-card">
          <div className="card-metric">
            <h3>Delivery Status</h3>
            <div className={`status-indicator ${getStatusColor(orderData.shipped_status)}`}>
              {orderData.shipped_status === 'fulfilled' ? (
                <>
                  <FaTruck /> Delivered
                </>
              ) : (
                <>
                  <FaBox /> {orderData.shipped_status || 'Pending'}
                </>
              )}
            </div>
            {orderData.shipment_date && (
              <p className="metric-label">Shipped: {formatDate(orderData.shipment_date)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'items' ? 'active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          Order Items ({lineItems.length})
        </button>
        <button 
          className={`tab ${activeTab === 'shipping' ? 'active' : ''}`}
          onClick={() => setActiveTab('shipping')}
        >
          Shipping
        </button>
        <button 
          className={`tab ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => setActiveTab('financial')}
        >
          Financial
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="info-grid">
              <div className="info-section">
                <h3><FaStore /> Order Information</h3>
                <div className="info-item">
                  <span className="label">Order Number</span>
                  <span className="value">{orderData.salesorder_number}</span>
                </div>
                <div className="info-item">
                  <span className="label">Reference Number</span>
                  <span className="value">{orderData.reference_number || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Order Date</span>
                  <span className="value">{formatDate(orderData.date)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Sales Channel</span>
                  <span className="value">{orderData.sales_channel || orderData.branch_name}</span>
                </div>
                {orderData.salesperson_name && (
                  <div className="info-item">
                    <span className="label">Sales Agent</span>
                    <span className="value">{orderData.salesperson_name}</span>
                  </div>
                )}
              </div>

              <div className="info-section">
                <h3><FaUser /> Customer Information</h3>
                <div className="info-item">
                  <span className="label">Customer</span>
                  <span className="value">{customerName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Email</span>
                  <span className="value">{customerDetails?.zoho_data?.email || orderData.email || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Phone</span>
                  <span className="value">
                    {customerDetails?.zoho_data?.phone || 
                     customerDetails?.zoho_data?.cf_phone_number || 
                     'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Customer ID</span>
                  <span className="value">{orderData.customer_id}</span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="order-timeline">
              <h3><FaClock /> Order Timeline</h3>
              <div className="timeline-items">
                <div className="timeline-item completed">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <h4>Order Created</h4>
                    <p>{formatDate(orderData.created_time)}</p>
                  </div>
                </div>
                
                {orderData.invoiced_status === 'invoiced' && (
                  <div className="timeline-item completed">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <h4>Invoice Generated</h4>
                      <p>Invoice created and sent</p>
                    </div>
                  </div>
                )}
                
                {orderData.paid_status === 'paid' && (
                  <div className="timeline-item completed">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <h4>Payment Received</h4>
                      <p>Payment confirmed</p>
                    </div>
                  </div>
                )}
                
                {orderData.shipment_date && (
                  <div className="timeline-item completed">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <h4>Order Shipped</h4>
                      <p>{formatDate(orderData.shipment_date)}</p>
                    </div>
                  </div>
                )}
                
                {orderData.shipped_status === 'fulfilled' && (
                  <div className="timeline-item completed">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <h4>Order Delivered</h4>
                      <p>Delivery confirmed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="items-tab">
            <h3>Order Items</h3>
            {!loadingItems && lineItems.length > 0 ? (
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item_name}</td>
                      <td>{item.sku}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      Order Total:
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {formatCurrency(orderData.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : loadingItems ? (
              <p>Loading line items...</p>
            ) : (
              <p>No line items found for this order.</p>
            )}
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="shipping-tab">
            <div className="shipping-grid">
              <div className="shipping-section">
                <h3><FaTruck /> Shipping Information</h3>
                <div className="info-item">
                  <span className="label">Shipping Status</span>
                  <span className={`value status-${getStatusColor(orderData.shipped_status)}`}>
                    {orderData.shipped_status || 'Pending'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Expected Delivery</span>
                  <span className="value">{formatDate(orderData.delivery_date)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Shipment Date</span>
                  <span className="value">{formatDate(orderData.shipment_date)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Items Packed</span>
                  <span className="value">{orderData.quantity_packed || 0} of {totalItemsCount || orderData.quantity || 0}</span>
                </div>
                <div className="info-item">
                  <span className="label">Items Shipped</span>
                  <span className="value">{orderData.quantity_shipped || 0} of {totalItemsCount || orderData.quantity || 0}</span>
                </div>
              </div>

              {orderData.shipping_address && (
                <div className="address-section">
                  <h3>Shipping Address</h3>
                  <div className="address-card">
                    <p>{orderData.shipping_address.attention}</p>
                    <p>{orderData.shipping_address.address}</p>
                    <p>{orderData.shipping_address.street2}</p>
                    <p>{orderData.shipping_address.city}, {orderData.shipping_address.state}</p>
                    <p>{orderData.shipping_address.zipcode}</p>
                    <p>{orderData.shipping_address.country}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="financial-tab">
            <div className="financial-grid">
              <div className="financial-card">
                <h3><FaMoneyBillWave /> Payment Information</h3>
                <div className="financial-item">
                  <span className="label">Total Amount</span>
                  <span className="value">{formatCurrency(orderData.total)}</span>
                </div>
                <div className="financial-item">
                  <span className="label">Balance Due</span>
                  <span className={`value ${orderData.balance > 0 ? 'overdue' : ''}`}>
                    {formatCurrency(orderData.balance)}
                  </span>
                </div>
                <div className="financial-item">
                  <span className="label">Payment Status</span>
                  <span className={`value status-${getStatusColor(orderData.paid_status)}`}>
                    {orderData.paid_status}
                  </span>
                </div>
                <div className="financial-item">
                  <span className="label">Invoice Status</span>
                  <span className={`value status-${getStatusColor(orderData.invoiced_status)}`}>
                    {orderData.invoiced_status}
                  </span>
                </div>
              </div>

              {orderData.billing_address && (
                <div className="financial-card">
                  <h3>Billing Address</h3>
                  <div className="address-card">
                    <p>{orderData.billing_address.attention}</p>
                    <p>{orderData.billing_address.address}</p>
                    <p>{orderData.billing_address.street2}</p>
                    <p>{orderData.billing_address.city}, {orderData.billing_address.state}</p>
                    <p>{orderData.billing_address.zipcode}</p>
                    <p>{orderData.billing_address.country}</p>
                  </div>
                </div>
              )}
            </div>

            {daysOverdue > 0 && orderData.paid_status !== 'paid' && (
              <div className="overdue-alert">
                <FaExclamationTriangle />
                <div>
                  <h4>Payment Overdue</h4>
                  <p>This order is {daysOverdue} days overdue.</p>
                  <button className="btn btn-warning">Send Payment Reminder</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}