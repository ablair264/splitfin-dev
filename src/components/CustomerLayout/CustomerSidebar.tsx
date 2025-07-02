// src/components/CustomerLayout/CustomerSidebar.tsx
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  FaHome, 
  FaShoppingCart, 
  FaFileInvoice, 
  FaBook, 
  FaUser,
  FaChevronDown,
  FaChevronRight,
  FaPlus,
  FaEye,
  FaEdit,
  FaMoneyBill,
  FaBookOpen,
  FaEnvelope
} from 'react-icons/fa';
import { auth, db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './CustomerSidebar.css';

interface MenuItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  submenu?: {
    label: string;
    path: string;
    icon: React.ReactNode;
  }[];
}

export default function CustomerSidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [customerDetails, setCustomerDetails] = useState({
    name: 'Customer Portal',
    company: 'Trade Account'
  });

  useEffect(() => {
    const fetchCustomerDetails = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Query customer_data collection by firebase_uid
        const customerDataQuery = query(
          collection(db, 'customer_data'),
          where('firebase_uid', '==', user.uid)
        );
        const customerDataSnapshot = await getDocs(customerDataQuery);
        
        if (!customerDataSnapshot.empty) {
          const data = customerDataSnapshot.docs[0].data();
          
          // Get customer name - try different fields
          let name = 'Customer';
          if (data.customer_name && data.customer_name !== data.email) {
            name = data.customer_name;
          } else if (data.first_name || data.last_name) {
            name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
          } else if (data.name) {
            name = data.name;
          } else if (data.contact_name) {
            name = data.contact_name;
          }
          
          // Get company name if available
          const company = data.company_name || data.company || 'Trade Account';
          
          setCustomerDetails({ name, company });
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
      }
    };

    fetchCustomerDetails();
  }, []);

  const toggleExpanded = (label: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedItems(newExpanded);
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Home',
      path: '/customer/dashboard',
      icon: <FaHome />
    },
    {
      label: 'Orders',
      icon: <FaShoppingCart />,
      submenu: [
        { label: 'New Order', path: '/customer/new-order', icon: <FaPlus /> },
        { label: 'View Orders', path: '/customer/orders', icon: <FaEye /> },
        { label: 'Amend Order', path: '/customer/amend-order', icon: <FaEdit /> }
      ]
    },
    {
      label: 'Invoices',
      icon: <FaFileInvoice />,
      submenu: [
        { label: 'View Invoices', path: '/customer/invoices', icon: <FaEye /> },
        { label: 'Pay Invoices', path: '/customer/pay-invoice', icon: <FaMoneyBill /> }
      ]
    },
    {
      label: 'Catalogues',
      icon: <FaBook />,
      submenu: [
        { label: 'View Catalogues', path: '/customer/catalogues', icon: <FaBookOpen /> },
        { label: 'Request Catalogue', path: '/customer/request-catalogue', icon: <FaEnvelope /> }
      ]
    },
    {
      label: 'Profile',
      path: '/customer/account',
      icon: <FaUser />
    }
  ];

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (item: MenuItem) => {
    if (item.path) return isActive(item.path);
    return item.submenu?.some(sub => isActive(sub.path)) || false;
  };

  return (
    <aside className="customer-sidebar">
      <div className="sidebar-header">
        <img src="/logos/dmb-logo.png" alt="DMB Distribution" className="sidebar-logo" />
      </div>
      
      <nav className="customer-sidebar-nav">
        {menuItems.map((item) => (
          <div key={item.label} className="nav-item-wrapper">
            {item.path ? (
              <NavLink
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ) : (
              <>
                <button
                  className={`nav-item accordion-toggle ${isParentActive(item) ? 'active' : ''}`}
                  onClick={() => toggleExpanded(item.label)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-chevron">
                    {expandedItems.has(item.label) ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                </button>
                
                <div className={`submenu ${expandedItems.has(item.label) ? 'expanded' : ''}`}>
                  {item.submenu?.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      className={`submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                    >
                      <span className="submenu-icon">{subItem.icon}</span>
                      <span className="submenu-label">{subItem.label}</span>
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {customerDetails.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <p className="user-name">{customerDetails.name}</p>
            <p className="user-role">{customerDetails.company}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}