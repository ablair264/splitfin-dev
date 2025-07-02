import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import './CustomerAmendOrder.css';

export default function CustomerAmendOrder() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAmendableOrders();
  }, []);

  const fetchAmendableOrders = async () => {
    try {
      if (!auth.currentUser) return;

      const ordersQuery = query(
        collection(db, 'salesorders'),
        where('customer_id', '==', auth.currentUser.uid),
        where('current_sub_status', '!=', 'closed'),
        orderBy('created_date', 'desc')
      );

      const snapshot = await getDocs(ordersQuery);
      const ordersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading amendable orders...</div>;
  }

  return (
    <div className="customer-amend-order">
      <h1>Amend Order</h1>
      <p>Select an order to amend (only pending orders can be amended)</p>
      
      {orders.length === 0 ? (
        <div className="no-amendable-orders">
          <p>No orders available for amendment</p>
        </div>
      ) : (
        <div className="amendable-orders-list">
          {orders.map(order => (
            <div key={order.id} className="amendable-order-card">
              <h3>Order #{order.salesorder_number}</h3>
              <p>Date: {new Date(order.created_date).toLocaleDateString()}</p>
              <p>Status: {order.current_sub_status}</p>
              <button className="amend-btn">Amend This Order</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}