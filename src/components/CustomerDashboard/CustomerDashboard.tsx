// src/components/CustomerDashboard/CustomerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { FaShoppingCart, FaFileInvoice, FaClock, FaCheckCircle, FaComments } from 'react-icons/fa';
import { useMessaging } from '../../contexts/MessagingContext';
import './CustomerDashboard.css';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  outstandingInvoices: number;
  recentActivity: any[];
}

interface Brand {
  id: string;
  name: string;
  logoUrl: string;
  description: string;
}

interface CustomerData {
  firebase_uid: string;
  customer_id: string;
  customer_name?: string;
  company_name?: string;
}

export default function CustomerDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    outstandingInvoices: 0,
    recentActivity: []
  });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  
  // Get messaging context - the UI is automatically rendered by the provider
  const { unreadTotal, openMessaging } = useMessaging();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!auth.currentUser) return;

      // Get customer data using Firebase UID
      const customerDoc = await getDoc(doc(db, 'customer_data', auth.currentUser.uid));
      
      if (!customerDoc.exists()) {
        console.error('No customer data found');
        return;
      }

      const customerInfo = customerDoc.data() as CustomerData;
      setCustomerData(customerInfo);

      // Fetch orders using customer_id
      const ordersQuery = query(
        collection(db, 'salesorders'),
        where('customer_id', '==', customerInfo.customer_id)
      );
      const ordersSnap = await getDocs(ordersQuery);
      
      const pendingCount = ordersSnap.docs.filter(doc => 
        ['pending', 'draft'].includes(doc.data().status?.toLowerCase() || '')
      ).length;

      // Fetch invoices using customer_id
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('customer_id', '==', customerInfo.customer_id),
        where('status', '!=', 'paid')
      );
      const invoicesSnap = await getDocs(invoicesQuery);

      // Fetch recent activity using customer_id
      const recentQuery = query(
        collection(db, 'salesorders'),
        where('customer_id', '==', customerInfo.customer_id),
        orderBy('date', 'desc'),
        limit(5)
      );
      const recentSnap = await getDocs(recentQuery);
      const recentActivity = recentSnap.docs.map(doc => ({
        id: doc.id,
        type: 'order',
        ...doc.data()
      }));

      setStats({
        totalOrders: ordersSnap.size,
        pendingOrders: pendingCount,
        outstandingInvoices: invoicesSnap.size,
        recentActivity
      });

      // Set up brands
      const brandList: Brand[] = [
        { id: 'blomus', name: 'Blomus', logoUrl: '/logos/blomus.png', description: 'Modern design for contemporary living' },
        { id: 'elvang', name: 'Elvang', logoUrl: '/logos/elvang.png', description: 'Scandinavian textiles' },
        { id: 'myflame', name: 'My Flame', logoUrl: '/logos/myflame.png', description: 'Scented candles with personality' },
        { id: 'rader', name: 'Räder', logoUrl: '/logos/rader.png', description: 'Poetry for living' },
        { id: 'remember', name: 'Remember', logoUrl: '/logos/remember.png', description: 'Colorful design' },
        { id: 'relaxound', name: 'Relaxound', logoUrl: '/logos/relaxound.png', description: 'Nature sounds' }
      ];
      setBrands(brandList);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dmb-dashboard-loading">Loading...</div>;
  }

  return (
    <div className="dmb-customer-dashboard">
      {/* Stats Cards */}
      <div className="dmb-dashboard-stats">
        <div className="dmb-stat-card">
          <div className="dmb-stat-icon">
            <FaShoppingCart />
          </div>
          <div className="dmb-stat-content">
            <h3>{stats.totalOrders}</h3>
            <p>Total Orders</p>
          </div>
          <Link to="/customer/orders" className="dmb-stat-link">View all →</Link>
        </div>

        <div className="dmb-stat-card">
          <div className="dmb-stat-icon dmb-pending">
            <FaClock />
          </div>
          <div className="dmb-stat-content">
            <h3>{stats.pendingOrders}</h3>
            <p>Pending Orders</p>
          </div>
          <Link to="/customer/orders?status=pending" className="dmb-stat-link">View pending →</Link>
        </div>

        <div className="dmb-stat-card">
          <div className="dmb-stat-icon dmb-warning">
            <FaFileInvoice />
          </div>
          <div className="dmb-stat-content">
            <h3>{stats.outstandingInvoices}</h3>
            <p>Outstanding Invoices</p>
          </div>
          <Link to="/customer/invoices" className="dmb-stat-link">View invoices →</Link>
        </div>

        {/* Add Messages Card */}
        <div className="dmb-stat-card dmb-clickable" onClick={openMessaging}>
          <div className="dmb-stat-icon dmb-messages">
            <FaComments />
          </div>
          <div className="dmb-stat-content">
            <h3>{unreadTotal}</h3>
            <p>Unread Messages</p>
          </div>
          <span className="dmb-stat-link">Open messages →</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dmb-quick-actions">
        <h2>Quick Actions</h2>
        <div className="dmb-actions-grid">
          <Link to="/customer/new-order" className="dmb-action-card">
            <FaShoppingCart />
            <span>New Order</span>
          </Link>
          <Link to="/customer/invoices/pay" className="dmb-action-card">
            <FaFileInvoice />
            <span>Pay Invoice</span>
          </Link>
          <Link to="/customer/catalogues" className="dmb-action-card">
            <FaFileInvoice />
            <span>View Catalogues</span>
          </Link>
          <div className="dmb-action-card" onClick={openMessaging}>
            <FaComments />
            <span>Messages</span>
          </div>
        </div>
      </div>

      {/* Brands Section */}
      <div className="dmb-brands-showcase">
        <h2>Our Brands</h2>
        <div className="dmb-brands-grid">
          {brands.map(brand => (
            <Link 
              to={`/customer/new-order?brand=${brand.id}`} 
              key={brand.id} 
              className="dmb-brand-card"
            >
              <div className="dmb-brand-logo">
                <img src={brand.logoUrl} alt={brand.name} />
              </div>
              <h3>{brand.name}</h3>
              <p>{brand.description}</p>
              <span className="dmb-brand-cta">Shop Now →</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {stats.recentActivity.length > 0 && (
        <div className="dmb-recent-activity">
          <h2>Recent Activity</h2>
          <div className="dmb-activity-list">
            {stats.recentActivity.map(activity => (
              <div key={activity.id} className="dmb-activity-item">
                <div className="dmb-activity-icon">
                  <FaShoppingCart />
                </div>
                <div className="dmb-activity-content">
                  <p>Order #{activity.salesorder_number}</p>
                  <span>{new Date(activity.date).toLocaleDateString()}</span>
                </div>
                <div className="dmb-activity-status">
                  <span className={`dmb-status dmb-${activity.status}`}>{activity.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The messaging UI popup is automatically rendered by the MessagingProvider */}
    </div>
  );
}