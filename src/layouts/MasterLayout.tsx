// MasterLayout.tsx - Updated with header bar
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import {
  FaChartLine, FaUsers, FaClipboardList, FaWarehouse, FaShoppingCart, FaCog, 
  FaPowerOff, FaChevronDown, FaChevronRight, FaPlus, FaKey, FaBars, FaTimes,
  FaMap, FaUserPlus, FaEnvelope, FaBell, FaFileInvoice, FaUserTie, FaFileAlt
} from 'react-icons/fa';
import './MasterLayout.css';
import { useUser } from '../components/UserContext';
import NotificationCenter from '../components/Notifications/NotificationCenter';
import { useMessaging } from '../contexts/MessagingContext';

type Section = 'Dashboard' | 'Reports' | 'Customers' | 'Orders' | 'Live Stocklists' | 'Purchase Orders' | 'Agent Management' | 'Settings';

interface NavLink {
  to: string;
  label: string;
  icon?: React.ReactNode;
}

const brands = [
  { name: 'Blomus', path: 'blomus' },
  { name: 'Elvang', path: 'elvang' },
  { name: 'My Flame Lifestyle', path: 'myflamelifestyle' },
  { name: 'Räder', path: 'rader' },
  { name: 'Remember', path: 'remember' },
  { name: 'Relaxound', path: 'relaxound' },
];

export default function MasterLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUser();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  
  // Get messaging context
  const messaging = useMessaging();

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  // Set user online when component mounts
  useEffect(() => {
    if (user?.uid) {
      const setUserOnline = async () => {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            isOnline: true,
            lastSeen: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error setting user online:', error);
        }
      };
      setUserOnline();
    }
  }, [user]);

  // Fetch pending approvals count for brand managers
 useEffect(() => {
  if (user?.role === 'brandManager') {
    const fetchPendingOrders = async () => {
      try {
        const q = query(
          collection(db, 'pending_orders'),
          where('status', '==', 'pending_approval')
        );
        const snapshot = await getDocs(q);
        setPendingOrders(snapshot.size);
      } catch (error) {
        console.error('Error fetching pending orders:', error);
      }
    };
    
    fetchPendingOrders();
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'pending_orders'), where('status', '==', 'pending_approval')),
      (snapshot) => {
        setPendingOrders(snapshot.size);
      },
      (error) => {
        console.error('Error listening to pending orders:', error);
      }
    );
    
    return () => unsubscribe();
  }
}, [user]);

  // Update message unread count from messaging context
useEffect(() => {
  if (messaging?.unreadTotal !== undefined) {
    setUnreadMessagesCount(messaging.unreadTotal);
  }
}, [messaging?.unreadTotal]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
      }
      
      await signOut(auth);
      localStorage.clear();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

const handleMessagesClick = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (messaging?.openMessaging) {
    messaging.openMessaging();
  }
};

 const getSectionConfig = () => {
  const config: Record<Section, { icon: React.ReactNode; links: NavLink[] }> = {
    Dashboard: {
      icon: <FaChartLine />,
      links: []
    },
    Reports: {
      icon: <FaFileAlt />,
      links: [
        { to: '/reports', label: 'Report Generator', icon: <FaChartLine /> },
        { to: '/reports/saved', label: 'Saved Reports', icon: <FaKey /> },
        ...(user?.role === 'brandManager' ? [
          { to: '/reports/templates', label: 'Report Templates', icon: <FaCog /> }
        ] : [])
      ]
    },
    Customers: {
      icon: <FaUsers />,
      links: [
        { to: '/customers/new', label: 'Add New Customer', icon: <FaPlus /> },
        { to: '/customers', label: 'View All Customers', icon: <FaKey /> },
        { to: '/customers/map', label: 'Customer Map', icon: <FaMap /> },
        ...(user?.role === 'brandManager' ? [
          { 
            to: '/customers/approval', 
            label: `Pending Approvals${pendingApprovals > 0 ? ` (${pendingApprovals})` : ''}`, 
            icon: <FaUserPlus /> 
          },
          { 
            to: '/customers/management', 
            label: 'Account Management', 
            icon: <FaKey /> 
          }
        ] : [])
      ]
    },
    Orders: {
      icon: <FaClipboardList />,
      links: [
        { to: '/customers', label: 'New Order', icon: <FaPlus /> },
        { to: '/orders', label: 'View All Orders', icon: <FaKey /> },
        ...(user?.role === 'brandManager' ? [
          { 
            to: '/orders/approval', 
            label: `Order Approvals${pendingOrders > 0 ? ` (${pendingOrders})` : ''}`, 
            icon: <FaUserPlus /> 
          },
          { to: '/invoices', label: 'Invoices', icon: <FaFileInvoice /> }
        ] : [])
      ]
    },
    'Live Stocklists': {
      icon: <FaWarehouse />,
      links: brands.map(b => ({ to: `/brand/${b.path}`, label: b.name }))
    },
    'Purchase Orders': {
      icon: <FaShoppingCart />,
      links: user?.role !== 'salesAgent' ? [
        { to: '/purchase-orders/new', label: 'New Purchase Order', icon: <FaPlus /> },
        { to: '/purchase-orders', label: 'View Purchase Orders', icon: <FaKey /> },
        { to: '/purchase-orders/order-management', label: 'Order Management', icon: <FaCog /> },
        { to: '/purchase-orders/purchase-suggestions', label: 'Purchase Assistant', icon: <FaKey /> }
      ] : []
    },
    'Agent Management': {
      icon: <FaUserTie />,
      links: []
    },
    Settings: {
      icon: <FaCog />,
      links: []
    }
  };
  return config;
};

const getAvailableSections = (): Section[] => {
  if (!user) return ['Dashboard'];
  
  if (user.role === 'salesAgent') {
    return ['Dashboard', 'Reports', 'Customers', 'Orders', 'Live Stocklists'];
  } else {
    return ['Dashboard', 'Reports', 'Customers', 'Orders', 'Live Stocklists', 'Purchase Orders', 'Agent Management', 'Settings'];
  }
};

  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </div>
      </div>
    );
  }

  const availableSections = getAvailableSections();
  const sectionConfig = getSectionConfig();
  
  const renderNavLinks = (isMobile = false) => (
    availableSections.map(section => {
      const config = sectionConfig[section];
      const isOpen = openSections.has(section);
      const hasSubItems = config.links.length > 0;
      const isDashboard = section === 'Dashboard';
      const isSettings = section === 'Settings';
      const isAgentManagement = section === 'Agent Management';

      if (isDashboard) {
        return <Link key={section} to="/dashboard" className={`master-sidebar-nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}><span className="nav-icon">{config.icon}</span><span className="nav-text">{section}</span></Link>;
      }
      if (isSettings) {
        return <Link key={section} to="/settings" className={`master-sidebar-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}><span className="nav-icon">{config.icon}</span><span className="nav-text">{section}</span></Link>;
      }
      if (isAgentManagement) {
        return <Link key={section} to="/agents" className={`master-sidebar-nav-item ${location.pathname === '/agents' ? 'active' : ''}`}><span className="nav-icon">{config.icon}</span><span className="nav-text">{section}</span></Link>;
      }
      return (
        <div key={section} className="master-sidebar-nav-section">
          <button className={`master-sidebar-nav-item ${isOpen ? 'active' : ''}`} onClick={() => toggleSection(section)}>
            <span className="nav-icon">{config.icon}</span>
            <span className="nav-text">{section}</span>
            {hasSubItems && <span className="nav-chevron">{isOpen ? <FaChevronDown /> : <FaChevronRight />}</span>}
          </button>
          {hasSubItems && (
            <div className={`master-sidebar-dropdown ${isOpen ? 'open' : ''}`}>
              {config.links.map(link => (
                <Link key={link.to} to={link.to} className={`master-sidebar-dropdown-item ${location.pathname === link.to ? 'active' : ''}`}>
                  {link.icon && <span className="dropdown-icon">{link.icon}</span>}
                  <span className="dropdown-text">{link.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <div className="master-layout-container">
      {/* Desktop Sidebar */}
      <nav className="master-sidebar-nav">
        <div className="master-sidebar-header">
          <div className="master-sidebar-logo">
            <img src="/logos/splitfinrow.png" alt="Splitfin Logo" className="master-logo-image" />
          </div>
        </div>
        <div className="master-sidebar-user-section">
          <div className="master-user-avatar"><span>{user.name.charAt(0).toUpperCase()}</span></div>
          <div className="master-user-info">
            <h4>{user.name}</h4>
            <p>{user.role === 'salesAgent' ? 'Sales Agent' : user.role === 'brandManager' ? 'Brand Manager' : 'Admin'}</p>
          </div>
        </div>
        <div className="master-sidebar-nav-sections">
          {renderNavLinks()}
        </div>
      </nav>
      
      {/* Mobile Top Bar */}
      <header className="master-mobile-top-bar">
        <div className="master-sidebar-logo">
          <img src="/logos/splitfinrow.png" alt="Splitfin Logo" className="master-mobile-logo" />
        </div>
        <button 
          type="button"
          className="master-mobile-menu-toggle" 
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        >
          {isMobileNavOpen ? <FaTimes /> : <FaBars />}
        </button>
      </header>
      
      {/* Mobile Navigation Dropdown */}
      <div className={`master-mobile-nav-dropdown ${isMobileNavOpen ? 'open' : ''}`}>
        <div className="master-mobile-user-info">
          <h4>{user.name}</h4>
          <p>{user.role === 'salesAgent' ? 'Sales Agent' : user.role === 'brandManager' ? 'Brand Manager' : 'Admin'}</p>
        </div>
        <hr className="mobile-nav-divider" />
        {renderNavLinks(true)}
        <hr className="mobile-nav-divider" />
        <div className="master-sidebar-footer">
          <div className="master-footer-actions">
            <button 
              type="button"
              className="master-footer-action-btn messages-btn" 
              onClick={(e) => {
                e.preventDefault();
                setIsMobileNavOpen(false);
                handleMessagesClick(e);
              }}
              title="Messages"
            >
              <FaEnvelope />
              {unreadMessagesCount > 0 && (
                <span className="action-badge">{unreadMessagesCount}</span>
              )}
            </button>
            
            <div className="footer-notification-wrapper">
              <NotificationCenter />
            </div>
            
            <button 
              type="button"
              className="master-footer-action-btn logout-btn" 
              onClick={handleLogout}
              title="Logout"
            >
              <FaPowerOff />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="master-main-content">
        {/* New Header Bar */}
        <header className="master-header-bar">
          <div className="master-header-actions">
            <button 
              type="button"
              className="master-header-action-btn messages-btn" 
              onClick={handleMessagesClick}
              title="Messages"
            >
              <FaEnvelope />
              {unreadMessagesCount > 0 && <span className="action-badge">{unreadMessagesCount}</span>}
            </button>
            
            <div className="header-notification-wrapper">
              <NotificationCenter />
            </div>
            
            <button 
              type="button"
              className="master-header-action-btn logout-btn" 
              onClick={handleLogout}
              title="Logout"
            >
              <FaPowerOff />
            </button>
          </div>
        </header>
        
        {/* Content Area */}
        <div className="master-content-area">
          <Outlet context={{ isAgentView: user.role === 'salesAgent' }} />
        </div>
      </main>
    </div>
  );
}