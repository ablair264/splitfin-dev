// src/components/CustomerOrderConfirmation/CustomerOrderConfirmation.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import { 
  FaCheckCircle, 
  FaEnvelope, 
  FaMapMarkerAlt, 
  FaClock, 
  FaPhone,
  FaTruck,
  FaFileAlt,
  FaStickyNote,
  FaArrowRight,
  FaHome
} from 'react-icons/fa';
import './CustomerOrderConfirmation.css';

interface Address {
  address1: string;
  street2: string;
  city: string;
  county: string;
  postcode: string;
}

interface OrderDetails {
  orderId: string;
  pendingOrderId?: string;
  customerName: string;
  email: string;
  phone: string;
  address: Address;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  orderDate: string;
  purchaseOrderNumber?: string;
  deliveryNotes?: string;
  status?: string;
}

export default function CustomerOrderConfirmation() {
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedOrder = localStorage.getItem('lastOrder');
    if (savedOrder) {
      const order = JSON.parse(savedOrder);
      setOrderDetails(order);
      localStorage.removeItem('lastOrder');
    } else {
      navigate('/customer/dashboard');
    }
  }, [navigate]);

  const handleCopyOrderId = () => {
    if (orderDetails) {
      navigator.clipboard.writeText(orderDetails.orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate estimated delivery (3-5 business days)
  const getEstimatedDelivery = () => {
    const today = new Date();
    const minDays = 3;
    const maxDays = 5;
    
    const addBusinessDays = (date: Date, days: number) => {
      const result = new Date(date);
      let addedDays = 0;
      while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0 && result.getDay() !== 6) {
          addedDays++;
        }
      }
      return result;
    };

    const minDate = addBusinessDays(today, minDays);
    const maxDate = addBusinessDays(today, maxDays);

    return `${minDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${maxDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };

  if (!orderDetails) {
    return (
      <div className="dmb-confirmation-loading">
        <div className="dmb-spinner"></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  const subtotal = orderDetails.totalAmount / 1.2;
  const vat = orderDetails.totalAmount - subtotal;

  return (
    <div className="dmb-order-confirmation">
      <ProgressBar currentStep={5} />
      
      {/* Success Header */}
      <div className="dmb-confirmation-hero">
        <div className="dmb-success-animation">
          <div className="dmb-success-circle">
            <FaCheckCircle className="dmb-check-icon" />
          </div>
          <div className="dmb-pending-badge">
            <FaClock />
            <span>Pending Approval</span>
          </div>
        </div>
        
        <h1>Thank you for your order!</h1>
        <p className="dmb-hero-subtitle">
          Your order has been successfully submitted and is being reviewed by our team.
        </p>
        
        <div className="dmb-order-reference" onClick={handleCopyOrderId}>
          <span className="dmb-order-label">Order Reference</span>
          <span className="dmb-order-number">{orderDetails.orderId}</span>
          <span className="dmb-copy-hint">{copied ? 'Copied!' : 'Click to copy'}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="dmb-timeline-section">
        <h2>What happens next?</h2>
        <div className="dmb-timeline">
          <div className="dmb-timeline-item active">
            <div className="dmb-timeline-icon">
              <FaFileAlt />
            </div>
            <div className="dmb-timeline-content">
              <h3>Order Submitted</h3>
              <p>Your order has been received</p>
              <span className="dmb-timeline-time">Just now</span>
            </div>
          </div>
          
          <div className="dmb-timeline-item">
            <div className="dmb-timeline-icon">
              <FaClock />
            </div>
            <div className="dmb-timeline-content">
              <h3>Under Review</h3>
              <p>Our team will review your order within 2-4 hours</p>
              <span className="dmb-timeline-time">Today</span>
            </div>
          </div>
          
          <div className="dmb-timeline-item">
            <div className="dmb-timeline-icon">
              <FaCheckCircle />
            </div>
            <div className="dmb-timeline-content">
              <h3>Order Confirmation</h3>
              <p>You'll receive an email once approved</p>
              <span className="dmb-timeline-time">Within 24 hours</span>
            </div>
          </div>
          
          <div className="dmb-timeline-item">
            <div className="dmb-timeline-icon">
              <FaTruck />
            </div>
            <div className="dmb-timeline-content">
              <h3>Delivery</h3>
              <p>Estimated delivery date</p>
              <span className="dmb-timeline-time">{getEstimatedDelivery()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dmb-confirmation-grid">
        {/* Order Summary */}
        <div className="dmb-order-summary-card">
          <div className="dmb-card-header">
            <h2>Order Summary</h2>
            <span className="dmb-order-date">{formatDate(orderDetails.orderDate)}</span>
          </div>
          
          <div className="dmb-order-items">
            {orderDetails.items.map((item, index) => (
              <div key={index} className="dmb-order-item">
                <div className="dmb-item-details">
                  <span className="dmb-item-name">{item.name}</span>
                  <span className="dmb-item-qty">Qty: {item.quantity}</span>
                </div>
                <span className="dmb-item-total">£{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div className="dmb-order-totals">
            <div className="dmb-total-row">
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="dmb-total-row">
              <span>VAT (20%)</span>
              <span>£{vat.toFixed(2)}</span>
            </div>
            <div className="dmb-total-row dmb-final-total">
              <span>Total</span>
              <span>£{orderDetails.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Additional Info */}
          {(orderDetails.purchaseOrderNumber || orderDetails.deliveryNotes) && (
            <div className="dmb-additional-info">
              {orderDetails.purchaseOrderNumber && (
                <div className="dmb-info-item">
                  <FaFileAlt />
                  <div>
                    <span className="dmb-info-label">PO Number</span>
                    <span className="dmb-info-value">{orderDetails.purchaseOrderNumber}</span>
                  </div>
                </div>
              )}
              
              {orderDetails.deliveryNotes && (
                <div className="dmb-info-item">
                  <FaStickyNote />
                  <div>
                    <span className="dmb-info-label">Delivery Notes</span>
                    <span className="dmb-info-value">{orderDetails.deliveryNotes}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delivery Details */}
        <div className="dmb-delivery-card">
          <h2>Delivery Information</h2>
          
          <div className="dmb-contact-info">
            <div className="dmb-contact-item">
              <FaMapMarkerAlt />
              <div>
                <span className="dmb-contact-label">Delivery Address</span>
                <address className="dmb-address">
                  {orderDetails.address.address1}<br />
                  {orderDetails.address.street2 && <>{orderDetails.address.street2}<br /></>}
                  {orderDetails.address.city}<br />
                  {orderDetails.address.county && <>{orderDetails.address.county}<br /></>}
                  {orderDetails.address.postcode}
                </address>
              </div>
            </div>
            
            <div className="dmb-contact-item">
              <FaPhone />
              <div>
                <span className="dmb-contact-label">Contact Number</span>
                <span className="dmb-contact-value">{orderDetails.phone}</span>
              </div>
            </div>
            
            <div className="dmb-contact-item">
              <FaEnvelope />
              <div>
                <span className="dmb-contact-label">Email</span>
                <span className="dmb-contact-value">{orderDetails.email}</span>
              </div>
            </div>
          </div>

          <div className="dmb-help-section">
            <h3>Need help?</h3>
            <p>If you have any questions about your order, please don't hesitate to contact us.</p>
            <a href="mailto:support@dmbrands.co.uk" className="dmb-help-link">
              support@dmbrands.co.uk
            </a>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="dmb-confirmation-actions">
        <button onClick={() => navigate('/customer/dashboard')} className="dmb-btn-secondary">
          <FaHome />
          Back to Dashboard
        </button>
        <button onClick={() => navigate('/customer/new-order')} className="dmb-btn-primary">
          Start New Order
          <FaArrowRight />
        </button>
      </div>
    </div>
  );
}