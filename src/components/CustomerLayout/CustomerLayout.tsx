// src/components/CustomerLayout/CustomerLayout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import CustomerSidebar from './CustomerSidebar';
import { FaBars, FaTimes, FaBell, FaShoppingCart, FaSignOutAlt, FaComments } from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useMessaging } from '../../contexts/MessagingContext';
import NotificationCenter from '../Notifications/NotificationCenter';
import './CustomerLayout.css';

export default function CustomerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const navigate = useNavigate();
  
  // Get messaging context for unread messages
  const { unreadTotal, openMessaging } = useMessaging();

  useEffect(() => {
    // Calculate initial order count
    updateOrderCount();

    // Listen for order updates
    const handleOrderUpdate = () => {
      updateOrderCount();
    };

    window.addEventListener('orderUpdated', handleOrderUpdate);

    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdate);
    };
  }, []);

  const updateOrderCount = () => {
    const order = JSON.parse(localStorage.getItem('customerOrder') || '[]');
    const totalItems = order.reduce((sum: number, item: any) => sum + item.quantity, 0);
    setOrderCount(totalItems);
  };

  const handleCustomerLogout = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Update customer_data collection
        const customerQuery = query(
          collection(db, 'customer_data'),
          where('firebase_uid', '==', user.uid)
        );
        const snapshot = await getDocs(customerQuery);
        
        if (!snapshot.empty) {
          await updateDoc(snapshot.docs[0].ref, {
            isOnline: false,
            lastSeen: new Date().toISOString()
          });
        }
        
        // Update users collection if exists
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: new Date().toISOString()
          });
        }
      }
      
      await signOut(auth);
      navigate('/customer/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="customer-layout">
      {/* Desktop Sidebar */}
      <CustomerSidebar />
      
      {/* Main Content Area */}
      <div className="layout-content">
        {/* Top Header */}
        <header className="customer-header">
          <div className="header-left">
            <button 
              className="mobile-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <FaBars />
            </button>
            <h1 className="page-title">DM Brands - Customer Portal</h1>
          </div>
          
          <div className="header-right">
            <Link to="/customer/cart" className="header-icon-btn">
              <FaShoppingCart />
              {orderCount > 0 && <span className="cart-badge">{orderCount}</span>}
            </Link>
            
            {/* Messages button with unread badge */}
            <button 
              className="header-icon-btn messages-btn"
              onClick={openMessaging}
              title="Messages"
            >
              <FaComments />
              {unreadTotal > 0 && <span className="messages-badge">{unreadTotal}</span>}
            </button>
            
            {/* Notification Center */}
            <NotificationCenter />
            
            <button 
              className="header-icon-btn logout-btn"
              onClick={handleCustomerLogout}
              title="Logout"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile Sidebar */}
      <div 
        className={`mobile-sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      
      <div className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="mobile-sidebar-header">
          <img src="/logos/dmb-logo.png" alt="DMB" className="mobile-logo" />
          <button 
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>
        <CustomerSidebar />
      </div>
    </div>
  );
}