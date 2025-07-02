import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaClipboardList, FaUser, FaSearch, FaSort } from 'react-icons/fa';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { useDashboard } from '../hooks/useDashboard';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import { NormalizedCustomer } from '../types/dashboard';
import './CustomersManagement.css';

interface CustomerData {
  firebase_uid: string;
  original_firebase_data: any;
  zoho_data: {
    customer_name: string;
    company_name: string;
    email: string;
    phone: string;
    credit_limit: number;
    outstanding_receivable_amount: number;
    overdue_amount: number;
    payment_performance: number;
    payment_terms: number;
    payment_terms_label: string;
    total_invoiced?: number;
    invoice_count?: number;
    addresses: any[];
    billing_address: any;
    shipping_address: any;
    contact_persons: any[];
    cf_phone_number?: string;
    location_region?: string;
    customer_sub_type: string;
    status: string;
    created_time: string;
    last_modified_time: string;
    notes?: string;
  };
  last_synced: any;
  sync_status: string;
}

// Keep your existing interfaces
interface Order {
  id: string;
  customer_id: string;
  salesperson_id?: string;
  date: any;
  status?: string;
  total?: number;
  [key: string]: any;
}

interface CustomerWithOrders extends NormalizedCustomer {
  city?: string;
  postcode?: string;
  orderStats?: {
    totalOrders: number;
    last6MonthsOrders: number;
    hasShippedOrder: boolean;
    hasConfirmedOrder: boolean;
  };
}

export default function CustomersManagement() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'orders' | 'name'>('name');
  const [allCustomers, setAllCustomers] = useState<CustomerWithOrders[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerOrders, setCustomerOrders] = useState<Record<string, any[]>>({});
  const navigate = useNavigate();

  const currentUserId = auth.currentUser?.uid;
  const { data, loading, error } = useDashboard({
    userId: currentUserId,
    dateRange: 'year',
    autoRefresh: false
  });

  const isBrandManager = data?.role === 'brandManager';

  // Fetch customers and their order data
useEffect(() => {
  const fetchCustomersAndOrders = async () => {
    if (!currentUserId || !data) return;
    
    try {
      setLoadingCustomers(true);
      
      // Get all orders first to calculate stats
      const ordersSnapshot = await getDocs(collection(db, 'salesorders'));
      const allOrdersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Order));

      // Group orders by customer
      const ordersByCustomer: Record<string, any[]> = {};
      allOrdersData.forEach(order => {
        const customerId = order.customer_id;
        if (!ordersByCustomer[customerId]) {
          ordersByCustomer[customerId] = [];
        }
        ordersByCustomer[customerId].push(order);
      });
      setCustomerOrders(ordersByCustomer);

      let customersData: CustomerWithOrders[] = [];
      
      if (isBrandManager) {
        // For brand managers, get ALL customers
        const customersSnapshot = await getDocs(collection(db, 'customer_data'));
        customersData = customersSnapshot.docs.map(doc => {
          const data = doc.data() as CustomerData;
          const customerId = data.firebase_uid || doc.id;
          const orders = ordersByCustomer[customerId] || [];
    
    // Calculate order stats
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const last6MonthsOrders = orders.filter(order => {
      const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.date);
      return orderDate >= sixMonthsAgo;
    });
    
    // Access data EXACTLY like CustomerDetail does
    const customerName = data.zoho_data?.company_name || 
                        data.zoho_data?.customer_name ||
                        'Unknown Company';
    
    return {
      id: doc.id,
      customer_id: customerId,
      name: customerName,  // ✅ Fixed
      customer_name: customerName,  // ✅ Fixed
      email: data.zoho_data?.email || '',  // ✅ Fixed
      phone: data.zoho_data?.phone || data.zoho_data?.cf_phone_number || '',  // ✅ Fixed
      city: data.zoho_data?.billing_address?.city || data.zoho_data?.shipping_address?.city || '',  // ✅ Fixed
      postcode: data.zoho_data?.billing_address?.zip || data.zoho_data?.shipping_address?.zip || '',  // ✅ Fixed
      total_spent: data.zoho_data?.total_invoiced || data.original_firebase_data?.total_spent || 0,
      order_count: data.zoho_data?.invoice_count || data.original_firebase_data?.order_count || 0,
      last_order_date: data.original_firebase_data?.last_order_date || '',
      first_order_date: data.original_firebase_data?.first_order_date || data.zoho_data?.created_time || '',
      created_time: data.zoho_data?.created_time || '',
      segment: data.original_firebase_data?.segment || 'Low',
      status: data.zoho_data?.status || 'active',
      assigned_agent_id: data.original_firebase_data?.salesperson_ids?.[0] || null,
      _source: data.original_firebase_data?._source || 'zoho',
      _originalId: data.original_firebase_data?._originalId || doc.id,
      orderStats: {
        totalOrders: orders.length,
        last6MonthsOrders: last6MonthsOrders.length,
        hasShippedOrder: orders.some(o => o.status === 'shipped'),
        hasConfirmedOrder: orders.some(o => o.status === 'confirmed')
      }
          } as CustomerWithOrders;
        });
      } else {
        // For agents, filter by their customers only
        const userDoc = await getDoc(doc(db, 'users', currentUserId));
        const userZohoId = userDoc.data()?.zohospID || userDoc.data()?.zohoAgentID;
        
        if (userZohoId) {
          // Get agent's orders to find their customer IDs
          const agentOrders = allOrdersData.filter(order => order.salesperson_id === userZohoId);
          const agentCustomerIds = new Set(agentOrders.map(order => order.customer_id));
          
          // Fetch only customers that have orders with this agent
          const customersSnapshot = await getDocs(collection(db, 'customer_data'));
          customersData = customersSnapshot.docs
            .map(doc => {
              const data = doc.data() as CustomerData;
              const customerId = data.firebase_uid || doc.id;
              
              // Only include if this customer has orders with this agent
              if (!agentCustomerIds.has(customerId)) {
                return null;
              }
              
              const orders = ordersByCustomer[customerId] || [];
              
              // Calculate order stats
              const sixMonthsAgo = new Date();
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
              
              const last6MonthsOrders = orders.filter(order => {
                const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.date);
                return orderDate >= sixMonthsAgo;
              });
              
              const customerName = data.zoho_data?.company_name || 
                                  data.zoho_data?.customer_name ||
                                  'Unknown Company';
              
              return {
                id: doc.id,
                customer_id: customerId,
                name: customerName,
                customer_name: customerName,
                email: data.zoho_data?.email || '',
                phone: data.zoho_data?.phone || data.zoho_data?.cf_phone_number || '',
                city: data.zoho_data?.billing_address?.city || data.zoho_data?.shipping_address?.city || '',
                postcode: data.zoho_data?.billing_address?.zip || data.zoho_data?.shipping_address?.zip || '',
                total_spent: data.zoho_data?.total_invoiced || data.original_firebase_data?.total_spent || 0,
                order_count: data.zoho_data?.invoice_count || data.original_firebase_data?.order_count || 0,
                last_order_date: data.original_firebase_data?.last_order_date || '',
                first_order_date: data.original_firebase_data?.first_order_date || data.zoho_data?.created_time || '',
                created_time: data.zoho_data?.created_time || '',
                segment: data.original_firebase_data?.segment || 'Low',
                status: data.zoho_data?.status || 'active',
                assigned_agent_id: data.original_firebase_data?.salesperson_ids?.[0] || null,
                _source: data.original_firebase_data?._source || 'zoho',
                _originalId: data.original_firebase_data?._originalId || doc.id,
                orderStats: {
                  totalOrders: orders.length,
                  last6MonthsOrders: last6MonthsOrders.length,
                  hasShippedOrder: orders.some(o => o.status === 'shipped'),
                  hasConfirmedOrder: orders.some(o => o.status === 'confirmed')
                }
              } as CustomerWithOrders;
            })
            .filter(customer => customer !== null) as CustomerWithOrders[];
        }
      }

      setAllCustomers(customersData);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  if (data) {
    fetchCustomersAndOrders();
  }
}, [currentUserId, data, isBrandManager]);

  const getCompanyLogo = (email: string) => {
    if (!email) return null;
    const domain = email.split('@')[1];
    if (!domain) return null;
    
    const excludedDomains = [
      'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
      'outlook.com', 'outlook.co.uk', 'live.com', 'live.co.uk', 'msn.com',
      'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com',
      'proton.me', 'yandex.com', 'mail.com', 'gmx.com', 'gmx.co.uk',
      'zoho.com', 'fastmail.com', 'tutanota.com', 'qq.com', '163.com', '126.com'
    ];
    
    if (excludedDomains.includes(domain.toLowerCase())) {
      return null;
    }
    
    return `https://logo.clearbit.com/${domain}`;
  };

  const getCustomerRank = (customer: CustomerWithOrders): string => {
    // Check order statuses first
    if (customer.orderStats?.hasShippedOrder) return 'Order In Progress';
    if (customer.orderStats?.hasConfirmedOrder) return 'Order Confirmed';

    // Check dates
    const now = new Date();
    const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
    
    // Check if new customer (created within last 6 months)
    const createdDate = customer.created_time ? new Date(customer.created_time) : null;
    if (createdDate && createdDate >= sixMonthsAgo) return 'New Customer';
    
    // Check last order date
    const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date) : null;
    if (lastOrderDate && lastOrderDate >= sixMonthsAgo) return 'Active';
    
    return 'Low Activity';
  };

  const getRankClass = (rank: string): string => {
    switch (rank) {
      case 'Active': return 'rank-active';
      case 'Low Activity': return 'rank-low';
      case 'New Customer': return 'rank-new';
      case 'Order In Progress': return 'rank-progress';
      case 'Order Confirmed': return 'rank-confirmed';
      default: return 'rank-low';
    }
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const activeCustomers = allCustomers.filter(c => {
      const lastOrderDate = c.last_order_date ? new Date(c.last_order_date) : null;
      return lastOrderDate && lastOrderDate >= sixMonthsAgo;
    });

    const customersWithRecentOrders = allCustomers.map(customer => {
      const orders = customerOrders[customer.customer_id || ''] || [];
      const recentOrders = orders.filter(order => {
        const orderDate = order.date?.toDate ? order.date.toDate() : new Date(order.date);
        return orderDate >= sixMonthsAgo;
      });
      return {
        customer,
        recentOrderCount: recentOrders.length,
        totalValue: recentOrders.reduce((sum, order) => sum + (order.total || 0), 0)
      };
    }).filter(c => c.recentOrderCount > 0);

    const topCustomer = customersWithRecentOrders.reduce((top, current) => 
      current.recentOrderCount > (top?.recentOrderCount || 0) ? current : top
    , customersWithRecentOrders[0]);

    const totalRecentValue = customersWithRecentOrders.reduce((sum, c) => sum + c.totalValue, 0);
    const totalRecentOrders = customersWithRecentOrders.reduce((sum, c) => sum + c.recentOrderCount, 0);
    const avgOrderValue = totalRecentOrders > 0 ? totalRecentValue / totalRecentOrders : 0;

    return {
      activeCustomers: activeCustomers.length,
      topCustomer: topCustomer ? {
        name: topCustomer.customer.name,
        orders: topCustomer.recentOrderCount
      } : null,
      avgOrderValue: avgOrderValue
    };
  }, [allCustomers, customerOrders]);

  const filteredAndSortedCustomers = useMemo(() => {
    const term = search.toLowerCase();
    let filtered = allCustomers.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.postcode?.toLowerCase().includes(term)
    );

    // Sort
    if (sortBy === 'orders') {
      filtered.sort((a, b) => (b.orderStats?.totalOrders || 0) - (a.orderStats?.totalOrders || 0));
    } else {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return filtered;
  }, [allCustomers, search, sortBy]);

  const handleNewOrder = (customer: CustomerWithOrders) => {
    const normalizedCustomer = {
      ...customer,
      id: customer.id,
      name: customer.name || 'Unknown',
    };

    localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(normalizedCustomer));
    navigate(`/select-brand/${customer.id}`, {
      state: { selectedCustomer: normalizedCustomer }
    });
  };

  const handleOrderHistory = (customer: CustomerWithOrders) => {
    navigate('/orders', { state: { customerId: customer.customer_id || customer.id } });
  };

  const handleViewDetails = (customer: CustomerWithOrders) => {
    navigate(`/customer/${customer.id}`);
  };
  
  const handleNewCustomer = () => {
  navigate('/new-customer');
};

  if (loading || loadingCustomers) {
    return (
      <div className="customers-loading">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
        <p>Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <h3>Error loading customers</h3>
        <p>{error}</p>
      </div>
    );
  }

return (
  <div className="customers-container">
    <div className="customers-header">
      <div className="header-row">
        <h1>Customers</h1>
        <button 
          className="btn btn-primary new-customer-btn"
          onClick={() => navigate('/new-customer')}
        >
          <FaPlus /> New Customer
        </button>
      </div>
    </div>

      {/* Metric Cards */}
      <div className="customers-metrics">
        <div className="metric-card">
          <div className="metric-value">{metrics.activeCustomers}</div>
          <div className="metric-label">Active Customers</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.topCustomer?.orders || 0}</div>
          <div className="metric-label">Most Orders (6 Months)</div>
          <div className="metric-sublabel">{metrics.topCustomer?.name || 'N/A'}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">£{metrics.avgOrderValue.toFixed(2)}</div>
          <div className="metric-label">Avg Order Value (6 Months)</div>
        </div>
      </div>

      {/* Search and Sort Bar */}
      <div className="customers-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by company, email, or postcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sort-wrapper">
          <FaSort className="sort-icon" />
          <select 
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'orders' | 'name')}
          >
            <option value="name">Sort by Name</option>
            <option value="orders">Sort by Most Orders</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="customers-list-view">
        {filteredAndSortedCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No customers found</h3>
            <p>Try adjusting your search</p>
          </div>
        ) : (
          filteredAndSortedCustomers.map((customer) => {
            const logoUrl = customer.email ? getCompanyLogo(customer.email) : null;
            const initial = customer.name ? customer.name.charAt(0).toUpperCase() : '?';
            const rank = getCustomerRank(customer);
            
            return (
              <div key={customer.id} className="customer-list-item">
                <div className="customer-logo">
                  {logoUrl ? (
                    <>
                      <img 
                        src={logoUrl} 
                        alt={customer.name}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="logo-initial" style={{ display: 'none' }}>
                        {initial}
                      </div>
                    </>
                  ) : (
                    <div className="logo-initial">
                      {initial}
                    </div>
                  )}
                </div>

                <div className="customer-info">
                  <div className="customer-name">{customer.name}</div>
                  <div className="customer-details">
                    <span className="customer-email">{customer.email || 'No email'}</span>
                    {customer.city && <span className="customer-city">• {customer.city}</span>}
                  </div>
                </div>

                <div className={`customer-rank ${getRankClass(rank)}`}>
                  {rank}
                </div>

                <div className="customer-actions">
                  <button 
                    className="action-btn primary"
                    onClick={() => handleNewOrder(customer)}
                  >
                    New Order
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewDetails(customer)}
                  >
                    View Details
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleOrderHistory(customer)}
                  >
                    Orders
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}