// src/components/OrderApproval/OrderApproval.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { createSalesOrder } from '../../api/zoho';
import './OrderApproval.css';

interface Address {
  address1: string;
  street2: string;
  city: string;
  county: string;
  postcode: string;
}

interface PendingOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCompany: string;
  customerId?: string;
  zohoContactId?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
  purchaseOrderNumber?: string;
  deliveryNotes?: string;
  shippingAddress: Address; // Changed from string[] to Address
  billingAddress: Address;  // Added billing address
  status: string;
  createdAt: string;
  zohoPayload: any;
}

export default function OrderApproval() {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    message: string;
  }>({
    isOpen: false,
    action: null,
    message: ''
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    try {
      const q = query(
        collection(db, 'pending_orders'),
        where('status', '==', 'pending_approval')
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingOrder));
      
      setPendingOrders(orders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (order: PendingOrder, action: 'approve' | 'reject') => {
    setSelectedOrder(order);
    setActionModal({
      isOpen: true,
      action,
      message: ''
    });
  };

  // Helper function to format address for display
  const formatAddress = (address: Address): string => {
    const parts = [
      address.address1,
      address.street2,
      address.city,
      address.county,
      address.postcode
    ].filter(part => part && part.trim() !== '');
    return parts.join(', ');
  };

  const processAction = async () => {
    if (!selectedOrder || !actionModal.action) return;
    
    console.log('=== ORDER APPROVAL DEBUG ===');
    console.log('Selected Order:', selectedOrder);
    console.log('Has zohoPayload?', !!selectedOrder.zohoPayload);
    console.log('zohoPayload:', selectedOrder.zohoPayload);
    
    if (!selectedOrder.zohoPayload) {
      alert('Error: Order is missing Zoho payload data. Check console for details.');
      console.error('Order missing zohoPayload:', selectedOrder);
      return;
    }
    
    setProcessing(true);
    
    try {
      if (actionModal.action === 'approve') {
        // Format the Zoho payload with proper address format
        const formattedZohoPayload = {
          ...selectedOrder.zohoPayload,
          // Ensure addresses are strings for Zoho
          billing_address: formatAddress(selectedOrder.billingAddress || selectedOrder.shippingAddress).substring(0, 99),
          shipping_address: formatAddress(selectedOrder.shippingAddress).substring(0, 99),
          // Include individual fields if needed
          billing_street: selectedOrder.billingAddress?.address1 || selectedOrder.shippingAddress.address1,
          billing_city: selectedOrder.billingAddress?.city || selectedOrder.shippingAddress.city,
          billing_state: selectedOrder.billingAddress?.county || selectedOrder.shippingAddress.county,
          billing_zip: selectedOrder.billingAddress?.postcode || selectedOrder.shippingAddress.postcode,
          billing_country: 'GB',
          shipping_street: selectedOrder.shippingAddress.address1,
          shipping_city: selectedOrder.shippingAddress.city,
          shipping_state: selectedOrder.shippingAddress.county,
          shipping_zip: selectedOrder.shippingAddress.postcode,
          shipping_country: 'GB'
        };

        // Create sales order in Zoho with formatted payload
        const zohoResponse = await createSalesOrder(formattedZohoPayload);
        
        // Update order status
        await updateDoc(doc(db, 'pending_orders', selectedOrder.id), {
          status: 'approved',
          approvedBy: auth.currentUser?.uid,
          approvedAt: new Date().toISOString(),
          zohoOrderId: zohoResponse.salesorder_id,
          zohoOrderNumber: zohoResponse.salesorder_number,
          updatedAt: new Date().toISOString()
        });
        
        // Create notification for customer
        if (selectedOrder.customerId) {
          await addDoc(collection(db, 'notifications'), {
            type: 'order_approved',
            recipientId: selectedOrder.customerId,
            title: 'Order Approved',
            message: `Your order ${selectedOrder.orderNumber} has been approved and is being processed.`,
            createdAt: new Date().toISOString(),
            read: false,
            data: {
              orderId: selectedOrder.id,
              orderNumber: selectedOrder.orderNumber,
              zohoOrderId: zohoResponse.salesorder_id
            }
          });
        }
        
        // Send confirmation email
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'https://splitfin-zoho-api.onrender.com';
          await fetch(`${apiUrl}/api/email/order-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: selectedOrder.customerEmail,
              orderNumber: selectedOrder.orderNumber,
              customerName: selectedOrder.customerName,
              items: selectedOrder.items,
              total: selectedOrder.total,
              deliveryAddress: formatAddress(selectedOrder.shippingAddress) // Convert to string for email
            })
          });
        } catch (emailError) {
          console.error('Failed to send confirmation email:', emailError);
        }
        
      } else {
        // Reject order
        await updateDoc(doc(db, 'pending_orders', selectedOrder.id), {
          status: 'rejected',
          rejectedBy: auth.currentUser?.uid,
          rejectedAt: new Date().toISOString(),
          rejectionReason: actionModal.message,
          updatedAt: new Date().toISOString()
        });
        
        // Create notification for customer
        if (selectedOrder.customerId) {
          await addDoc(collection(db, 'notifications'), {
            type: 'order_rejected',
            recipientId: selectedOrder.customerId,
            title: 'Order Update',
            message: `Your order ${selectedOrder.orderNumber} requires attention. Please check your messages.`,
            createdAt: new Date().toISOString(),
            read: false,
            data: {
              orderId: selectedOrder.id,
              orderNumber: selectedOrder.orderNumber,
              reason: actionModal.message
            }
          });
        }
      }
      
      // Refresh the list
      await fetchPendingOrders();
      
      // Close modal
      setActionModal({ isOpen: false, action: null, message: '' });
      setSelectedOrder(null);
      
    } catch (error) {
      console.error('Error processing order:', error);
      alert('Failed to process order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading pending orders...</div>;
  }

  return (
    <div className="order-approval-container">
      <header className="approval-header">
        <h1>Pending Order Approvals</h1>
        <p>Review and approve customer orders</p>
      </header>

      {pendingOrders.length === 0 ? (
        <div className="no-orders">
          <p>No pending orders to approve</p>
        </div>
      ) : (
        <div className="orders-grid">
          {pendingOrders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <h3>Order #{order.orderNumber}</h3>
                <span className="order-date">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="split-order-customer">
                <h4>{order.customerName}</h4>
                {order.customerCompany && <p>{order.customerCompany}</p>}
                <p>{order.customerEmail}</p>
                {order.customerPhone && <p>{order.customerPhone}</p>}
              </div>
              
              <div className="order-shipping">
                <h4>Delivery Address</h4>
                <p>{order.shippingAddress?.address1 || 'Not provided'}</p>
                {order.shippingAddress?.street2 && <p>{order.shippingAddress.street2}</p>}
                <p>
                  {order.shippingAddress?.city && `${order.shippingAddress.city}, `}
                  {order.shippingAddress?.postcode}
                </p>
              </div>
              
              <div className="order-items-summary">
                <h4>Items ({order.items.length})</h4>
                {order.items.slice(0, 3).map((item, index) => (
                  <div key={index} className="item-line">
                    <span>{item.name}</span>
                    <span>×{item.quantity}</span>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="more-items">+{order.items.length - 3} more items</p>
                )}
              </div>
              
              {order.purchaseOrderNumber && (
                <div className="po-number">
                  <strong>PO:</strong> {order.purchaseOrderNumber}
                </div>
              )}
              
              <div className="order-total-section">
                <div className="total-line">
                  <span>Subtotal:</span>
                  <span>£{order.subtotal.toFixed(2)}</span>
                </div>
                <div className="total-line">
                  <span>VAT:</span>
                  <span>£{order.vat.toFixed(2)}</span>
                </div>
                <div className="total-line total">
                  <span>Total:</span>
                  <span>£{order.total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="action-buttons">
                <button
                  className="approve-btn"
                  onClick={() => handleAction(order, 'approve')}
                >
                  Approve Order
                </button>
                <button
                  className="reject-btn"
                  onClick={() => handleAction(order, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal.isOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setActionModal({ isOpen: false, action: null, message: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>
              {actionModal.action === 'approve' ? 'Approve Order' : 'Reject Order'}
            </h2>
            
            <div className="modal-order-details">
              <p><strong>Order:</strong> #{selectedOrder.orderNumber}</p>
              <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
              <p><strong>Total:</strong> £{selectedOrder.total.toFixed(2)}</p>
            </div>
            
            {actionModal.action === 'approve' ? (
              <div className="approval-notice">
                <p>Approving this order will:</p>
                <ul>
                  <li>Create the sales order in Zoho</li>
                  <li>Send a confirmation email to the customer</li>
                  <li>Begin the fulfillment process</li>
                </ul>
              </div>
            ) : (
              <div className="form-group">
                <label>Reason for Rejection (Required)</label>
                <textarea
                  value={actionModal.message}
                  onChange={(e) => setActionModal({ ...actionModal, message: e.target.value })}
                  placeholder="Please provide a reason for rejecting this order..."
                  rows={4}
                  required
                />
              </div>
            )}
            
            <div className="modal-actions">
              <button
                onClick={processAction}
                disabled={processing || (actionModal.action === 'reject' && !actionModal.message)}
                className={`${actionModal.action}-btn`}
              >
                {processing ? 'Processing...' : `Confirm ${actionModal.action}`}
              </button>
              <button
                onClick={() => setActionModal({ isOpen: false, action: null, message: '' })}
                disabled={processing}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}