// src/components/Notifications/NotificationCenter.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUser } from '../UserContext';
import { useNavigate } from 'react-router-dom';
import { useMessaging } from '../../contexts/MessagingContext';
import { FaBell, FaTimes, FaCheck } from 'react-icons/fa';
import './NotificationCenter.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  recipientId: string;
  recipientType?: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  data?: any;
}

export default function NotificationCenter() {
  const user = useUser();
  const navigate = useNavigate();
const { selectUser } = useMessaging();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    // Query for user's notifications
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    // Also query for role-based notifications
    const roleQ = query(
      collection(db, 'notifications'),
      where('recipientType', '==', user.role),
      where('recipientId', '==', null),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    // Subscribe to notifications
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    const promises = unreadNotifs.map(n => 
      updateDoc(doc(db, 'notifications', n.id), {
        read: true,
        readAt: new Date().toISOString()
      })
    );
    
    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Combined notification click handler
  const handleNotificationClick = (notification: Notification) => {
    // Close the dropdown
    setShowDropdown(false);
    
    // Handle different notification types
    if (notification.type === 'customer_signup_request') {
      navigate('/customers/approvals');
      markAsRead(notification.id);
    }
else if (notification.type === 'new_message') {
  // Open messaging popup with the conversation
  selectUser(notification.data.senderId);
  markAsRead(notification.id);
}
    else if (notification.type === 'order_created' || notification.type === 'order_updated') {
      if (notification.data?.orderId) {
        navigate(`/order/${notification.data.orderId}`);
      } else {
        navigate('/orders');
      }
      markAsRead(notification.id);
    }
    else if (notification.type === 'invoice_overdue') {
      navigate('/invoices');
      markAsRead(notification.id);
    }
    else if (notification.type === 'payment_received') {
      navigate('/invoices');
      markAsRead(notification.id);
    }
    else if (notification.type === 'account_created' || notification.type === 'account_invitation') {
      navigate('/customers');
      markAsRead(notification.id);
    }
    else {
      // Default case - just mark as read
      console.warn('Unknown notification type:', notification.type);
      markAsRead(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_created':
      case 'order_updated':
        return '📦';
      case 'customer_signup_request':
        return '👤';
      case 'account_created':
      case 'account_invitation':
        return '✉️';
      case 'payment_received':
        return '💰';
      case 'new_message':
        return '💬';
      case 'invoice_overdue':
        return '⚠️';
      default:
        return '📢';
    }
  };

  return (
    <div className="notification-center">
      <button 
        className="notification-bell"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <FaBell />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="notification-overlay" onClick={() => setShowDropdown(false)} />
          <div className="notification-dropdown">
            <div className="notification-header">
              <h3>Notifications</h3>
              <div className="notification-actions">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="mark-all-read">
                    <FaCheck /> Mark all read
                  </button>
                )}
                <button onClick={() => setShowDropdown(false)} className="close-btn">
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">
                  <FaBell />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div 
                    key={notification.id}
                    className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="notification-icon">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="notification-content">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <span className="notification-time">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {!notification.read && <div className="unread-indicator" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}