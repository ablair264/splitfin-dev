// src/components/OrderSummary.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../firebase';
import { ProgressBar } from './ProgressBar';
import './OrderSummary.css';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface OrderItem {
  product: {
    id: string;
    item_id: string;
    name: string;
    sku: string;
    price: number;
    brand: string;
  };
  qty: number;
  total: number;
}

export default function OrderSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(true);
  
  const orderData = location.state as {
    items: OrderItem[];
    orderTotal: number;
    brand: string;
    customer: any;
  };

  useEffect(() => {
    if (!orderData) {
      navigate('/');
      return;
    }
    checkCustomerStatus();
  }, []);

  const checkCustomerStatus = async () => {
    try {
      setCheckingCustomer(true);
      
      // Get latest customer data from Firebase
      const customerDoc = await getDoc(doc(db, 'customer_data', orderData.customer.id));
      if (customerDoc.exists()) {
        const data = customerDoc.data();
        setCustomerData(data);
        
        // If customer doesn't have a customer_id, we need to wait or sync
        if (!data.customer_id && data.sync_status === 'pending') {
          // Poll for customer_id
          const maxAttempts = 30; // 30 seconds
          let attempts = 0;
          
          const pollInterval = setInterval(async () => {
            attempts++;
            const updatedDoc = await getDoc(doc(db, 'customer_data', orderData.customer.id));
            const updatedData = updatedDoc.data();
            
            if (updatedData?.customer_id || attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setCustomerData(updatedData);
              setCheckingCustomer(false);
            }
          }, 1000);
        } else {
          setCheckingCustomer(false);
        }
      }
    } catch (error) {
      console.error('Error checking customer:', error);
      setCheckingCustomer(false);
    }
  };

  const handleSubmitOrder = async () => {
    try {
      setLoading(true);
      setError('');

      // Wait for customer_id if it's missing
      let finalCustomerData = customerData;
      
      if (!customerData?.customer_id) {
        console.log('Customer ID not yet available, polling...');
        
        // Poll for up to 30 seconds
        const maxAttempts = 30;
        let attempts = 0;
        let customerIdFound = false;
        
        while (attempts < maxAttempts && !customerIdFound) {
          const customerDoc = await getDoc(doc(db, 'customer_data', orderData.customer.id));
          const latestData = customerDoc.data();
          
          if (latestData?.customer_id) {
            finalCustomerData = latestData;
            customerIdFound = true;
            console.log('Customer ID found:', latestData.customer_id);
          } else {
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!customerIdFound) {
          setError('Customer setup is taking longer than expected. Please try again in a moment.');
          setLoading(false);
          return;
        }
      }

      // Now proceed with the order using finalCustomerData
      const orderNumber = `SO-${Date.now()}`;
      
      const webhookPayload = {
        salesorder_number: orderNumber,
        date: new Date().toISOString().split('T')[0],
        
        customer: {
          firebase_id: orderData.customer.id,
          customer_id: finalCustomerData.customer_id, // Now guaranteed to have value
          name: orderData.customer.name,
          email: orderData.customer.email,
          company: orderData.customer.company_name || ''
        },
        
        // Line items
        line_items: orderData.items.map(item => ({
          item_id: item.product.item_id || '',
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.qty,
          rate: item.product.price,
          amount: item.total,
          brand: item.product.brand
        })),
        
        // Totals
        subtotal: orderData.orderTotal,
        vat_amount: orderData.orderTotal * 0.2,
        total: orderData.orderTotal * 1.2,
        
        // Additional info
        brand: orderData.brand,
        notes: `Order placed via web app - Brand: ${orderData.brand}`,
        created_by: auth.currentUser?.email || 'Web Order',
        created_at: new Date().toISOString()
      };

      // Send to Make.com webhook
      const response = await fetch('https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      console.log('Order sent to Make.com webhook successfully');

      // Save order to Firebase for reference
      const orderDoc = await setDoc(doc(db, 'salesorders', orderNumber), {
        ...webhookPayload,
        firebase_customer_id: orderData.customer.id,
        webhook_sent: true,
        webhook_sent_at: new Date().toISOString(),
        status: 'pending_processing'
      });

      // Clear order data and navigate to confirmation
      localStorage.removeItem(`ORDER_SELECTED_${orderData.customer.id}`);
      
      navigate('/order-confirmation', {
        state: {
          orderId: orderNumber,
          orderNumber: orderNumber,
          customer: finalCustomerData || orderData.customer,
          items: orderData.items,
          total: orderData.orderTotal
        }
      });

    } catch (error) {
      console.error('Error submitting order:', error);
      setError('Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!orderData) {
    return null;
  }
  
  const createOrderNotifications = async (orderNumber: string, customerData: any, orderTotal: number, itemCount: number) => {
  try {
    // Find sammie@dmbrands.co.uk user
    let sammieUserId = null;
    
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', 'sammie@dmbrands.co.uk')
    );
    const usersSnapshot = await getDocs(usersQuery);
    
    if (!usersSnapshot.empty) {
      sammieUserId = usersSnapshot.docs[0].id;
    } else {
      const staffQuery = query(
        collection(db, 'staff_users'),
        where('email', '==', 'sammie@dmbrands.co.uk')
      );
      const staffSnapshot = await getDocs(staffQuery);
      if (!staffSnapshot.empty) {
        sammieUserId = staffSnapshot.docs[0].data().uid || staffSnapshot.docs[0].id;
      }
    }
    
    // Create notification for sammie@dmbrands.co.uk
    if (sammieUserId) {
      await addDoc(collection(db, 'notifications'), {
        type: 'order_approval_request',
        recipientId: sammieUserId,
        recipientEmail: 'sammie@dmbrands.co.uk',
        title: 'New Order Submitted',
        message: `${customerData.name} has submitted an order #${orderNumber} for £${(orderTotal * 1.2).toFixed(2)} via webhook.`,
        createdAt: new Date().toISOString(),
        read: false,
        data: {
          orderNumber: orderNumber,
          customerName: customerData.name,
          total: orderTotal * 1.2, // Including VAT
          itemCount: itemCount,
          orderId: orderNumber // For navigation purposes
        }
      });
    }
    
    // Create general notification for all brand managers
    await addDoc(collection(db, 'notifications'), {
      type: 'order_approval_request', 
      recipientRole: 'brandManager',
      title: 'New Order Submitted',
      message: `${customerData.name} has submitted an order via web app.`,
      createdAt: new Date().toISOString(),
      read: false,
      data: {
        orderNumber: orderNumber,
        customerName: customerData.name,
        total: orderTotal * 1.2,
        itemCount: itemCount
      }
    });

    console.log('Order notifications created successfully');
  } catch (error) {
    console.error('Error creating order notifications:', error);
    // Don't throw - we don't want to fail the order if notifications fail
  }
};

  const subtotal = orderData.orderTotal;
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  return (
    <div className="order-summary-page">
      <div className="progress-bar-container">
        <ProgressBar currentStep={3} theme="dark" />
      </div>
      
      <div className="order-summary-container">
        <div className="summary-header">
          <h1>Order Summary</h1>
          <p>Please review your order before submitting</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {checkingCustomer && (
          <div className="info-message">
            <div className="spinner"></div>
            Setting up customer account...
          </div>
        )}

        <div className="summary-content">
          {/* Customer Information */}
          <div className="summary-section">
            <h2>Customer Information</h2>
            <div className="customer-details">
              <div className="detail-row">
                <span className="label">Name:</span>
                <span className="value">{orderData.customer.name}</span>
              </div>
              <div className="detail-row">
                <span className="label">Email:</span>
                <span className="value">{orderData.customer.email}</span>
              </div>
              {orderData.customer.company_name && (
                <div className="detail-row">
                  <span className="label">Company:</span>
                  <span className="value">{orderData.customer.company_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="summary-section">
            <h2>Order Items - {orderData.brand}</h2>
            <div className="order-items-list">
              {orderData.items.map((item, index) => (
                <div key={index} className="order-item-row">
                  <div className="item-details">
                    <span className="item-name">{item.product.name}</span>
                    <span className="item-sku">SKU: {item.product.sku}</span>
                  </div>
                  <div className="item-quantity">
                    Qty: {item.qty}
                  </div>
                  <div className="item-price">
                    £{item.total.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Totals */}
          <div className="summary-section">
            <div className="totals-container">
              <div className="total-row">
                <span>Subtotal</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>VAT (20%)</span>
                <span>£{vat.toFixed(2)}</span>
              </div>
              <div className="total-row final">
                <span>Total</span>
                <span>£{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="summary-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate(-1)}
              disabled={loading}
            >
              Back to Products
            </button>
            <button 
              className="btn-primary"
              onClick={handleSubmitOrder}
              disabled={loading || checkingCustomer}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Submitting Order...
                </>
              ) : (
                'Submit Order'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}