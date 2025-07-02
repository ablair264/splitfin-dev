// src/components/CustomerOrderDetail/CustomerOrderDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  FaArrowLeft, FaFileInvoice, FaBox, FaTruck, 
  FaCheckCircle, FaClock, FaMapMarkerAlt, FaCreditCard
} from 'react-icons/fa';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import './CustomerOrderDetail.css';

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
  line_items?: any[];
  shipping_address?: any;
  tracking_number?: string;
}

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    }
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const orderDoc = await getDoc(doc(db, 'salesorders', orderId));
      
      if (orderDoc.exists()) {
        setOrderData(orderDoc.data() as OrderData);
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderProgress = () => {
    if (!orderData) return 1;
    const status = orderData.status?.toLowerCase() || '';
    
    if (status === 'delivered' || orderData.shipped_status === 'fulfilled') return 5;
    if (status === 'shipped') return 4;
    if (status === 'packed' || status === 'confirmed') return 3;
    if (status === 'pending' || status === 'draft') return 2;
    return 1;
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      return new Date(dateValue).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (value: number) => {
    return `£${(value || 0).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="customer-order-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="customer-order-detail-error">
        <h2>Order not found</h2>
        <button onClick={() => navigate('/customer/orders')} className="btn btn-primary">
          Back to My Orders
        </button>
      </div>
    );
  }

  const currentProgress = getOrderProgress();

  return (
    <div className="customer-order-detail">
      {/* Progress Bar */}
      <ProgressBar currentStep={currentProgress} />

      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={() => navigate('/customer/orders')}>
          <FaArrowLeft /> Back to My Orders
        </button>
        
        <div className="header-info">
          <h1>Order #{orderData.salesorder_number}</h1>
          <span className={`order-status ${orderData.status?.toLowerCase()}`}>
            {orderData.status}
          </span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="order-summary-section">
        <div className="summary-card">
          <FaBox className="summary-icon" />
          <div className="summary-content">
            <h3>Order Date</h3>
            <p>{formatDate(orderData.date)}</p>
          </div>
        </div>

        <div className="summary-card">
          <FaTruck className="summary-icon" />
          <div className="summary-content">
            <h3>Delivery Status</h3>
            <p>{orderData.shipped_status || 'Processing'}</p>
            {orderData.tracking_number && (
              <span className="tracking">Track: {orderData.tracking_number}</span>
            )}
          </div>
        </div>

        <div className="summary-card">
          <FaCreditCard className="summary-icon" />
          <div className="summary-content">
            <h3>Payment Status</h3>
            <p className={orderData.paid_status === 'paid' ? 'paid' : 'unpaid'}>
              {orderData.paid_status === 'paid' ? 'Paid' : 'Unpaid'}
            </p>
            {orderData.balance > 0 && (
              <span className="balance">Balance: {formatCurrency(orderData.balance)}</span>
            )}
          </div>
        </div>

        <div className="summary-card">
          <FaFileInvoice className="summary-icon" />
          <div className="summary-content">
            <h3>Invoice Status</h3>
            <p>{orderData.invoiced_status || 'Pending'}</p>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="order-items-section">
        <h2>Order Items</h2>
        <div className="items-table">
          <table>
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
              {orderData.line_items?.map((item, index) => (
                <tr key={index}>
                  <td>{item.name || item.item_name}</td>
                  <td>{item.sku || 'N/A'}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.rate || item.price || 0)}</td>
                  <td>{formatCurrency(item.item_total || item.total || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Order Total</td>
                <td>{formatCurrency(orderData.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Shipping Information */}
      {orderData.shipping_address && (
        <div className="shipping-info-section">
          <h2><FaMapMarkerAlt /> Shipping Information</h2>
          <div className="shipping-address">
            <p>{orderData.shipping_address.attention}</p>
            <p>{orderData.shipping_address.address}</p>
            {orderData.shipping_address.street2 && <p>{orderData.shipping_address.street2}</p>}
            <p>{orderData.shipping_address.city}, {orderData.shipping_address.state} {orderData.shipping_address.zipcode}</p>
            <p>{orderData.shipping_address.country}</p>
          </div>
          {orderData.delivery_date && (
            <p className="delivery-date">
              Expected Delivery: {formatDate(orderData.delivery_date)}
            </p>
          )}
        </div>
      )}

      {/* Order Timeline */}
      <div className="order-timeline-section">
        <h2><FaClock /> Order Timeline</h2>
        <div className="timeline">
          <div className="timeline-item completed">
            <div className="timeline-marker"><FaCheckCircle /></div>
            <div className="timeline-content">
              <h4>Order Placed</h4>
              <p>{formatDate(orderData.created_time)}</p>
            </div>
          </div>
          
          {orderData.invoiced_status === 'invoiced' && (
            <div className="timeline-item completed">
              <div className="timeline-marker"><FaCheckCircle /></div>
              <div className="timeline-content">
                <h4>Invoice Generated</h4>
                <p>Invoice sent to your email</p>
              </div>
            </div>
          )}
          
          {orderData.paid_status === 'paid' && (
            <div className="timeline-item completed">
              <div className="timeline-marker"><FaCheckCircle /></div>
              <div className="timeline-content">
                <h4>Payment Received</h4>
                <p>Thank you for your payment</p>
              </div>
            </div>
          )}
          
          {orderData.shipment_date && (
            <div className="timeline-item completed">
              <div className="timeline-marker"><FaCheckCircle /></div>
              <div className="timeline-content">
                <h4>Order Shipped</h4>
                <p>{formatDate(orderData.shipment_date)}</p>
              </div>
            </div>
          )}
          
          {orderData.shipped_status === 'fulfilled' && (
            <div className="timeline-item completed">
              <div className="timeline-marker"><FaCheckCircle /></div>
              <div className="timeline-content">
                <h4>Delivered</h4>
                <p>Order successfully delivered</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="order-actions">
        {orderData.invoiced_status === 'invoiced' && (
          <button 
            className="btn btn-secondary"
            onClick={() => navigate(`/customer/invoice/${orderData.salesorder_id}`)}
          >
            <FaFileInvoice /> View Invoice
          </button>
        )}
        
        {orderData.balance > 0 && orderData.paid_status !== 'paid' && (
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/customer/pay-invoice')}
          >
            <FaCreditCard /> Pay Invoice
          </button>
        )}
        
        {orderData.status === 'delivered' && (
          <button className="btn btn-secondary">
            Reorder Items
          </button>
        )}
      </div>
    </div>
  );
}