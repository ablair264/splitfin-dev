// src/components/OrderConfirmation.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProgressBar } from './ProgressBar';
import { 
  FaCheckCircle, 
  FaEnvelope, 
  FaClock,
  FaArrowRight,
  FaHome
} from 'react-icons/fa';
import './OrderConfirmation.css';

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    if (location.state) {
      setOrderDetails(location.state);
    } else {
      navigate('/');
    }
  }, []);

  if (!orderDetails) {
    return null;
  }

  return (
    <div className="order-confirmation-page">
    <div className="progress-bar-container">
      <ProgressBar currentStep={5} theme="dark" />
      </div>
      
      <div className="confirmation-container">
        <div className="confirmation-hero">
          <div className="success-animation">
            <div className="success-circle">
              <FaCheckCircle className="check-icon" />
            </div>
          </div>
          
          <h1>Order Successfully Placed!</h1>
          <p className="hero-subtitle">
            Thank you for your order. We've sent a confirmation email to {orderDetails.customer.email}
          </p>
          
          <div className="order-reference">
            <span className="order-label">Order Number</span>
            <span className="order-number">{orderDetails.orderNumber}</span>
          </div>
        </div>

        <div className="confirmation-details">
          <div className="detail-card">
            <h2>What Happens Next?</h2>
            <div className="timeline">
              <div className="timeline-item active">
                <FaCheckCircle />
                <div>
                  <h3>Order Received</h3>
                  <p>We've received your order and sent you a confirmation email</p>
                </div>
              </div>
              <div className="timeline-item">
                <FaClock />
                <div>
                  <h3>Processing</h3>
                  <p>We're preparing your order for shipment</p>
                </div>
              </div>
              <div className="timeline-item">
                <FaEnvelope />
                <div>
                  <h3>Customer Account</h3>
                  <p>Check your email for login details to track your order</p>
                </div>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button onClick={() => navigate('/')} className="btn-secondary">
              <FaHome />
              Back to Dashboard
            </button>
            <button onClick={() => navigate(`/select-brand/${orderDetails.customer.id}`)} className="btn-primary">
              Start New Order
              <FaArrowRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}