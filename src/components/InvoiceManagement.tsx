import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaFileInvoice, FaUser, FaDownload, FaEnvelope, FaSearch, FaFilter, FaExclamationTriangle } from 'react-icons/fa';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { auth, db } from '../firebase';
import { collection, getDocs, query, where, orderBy, getDoc, doc } from 'firebase/firestore';
import './InvoiceManagement.css';

interface Invoice {
  id: string;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  status: string;
  current_sub_status?: string;
  payment_expected_date?: string;
  last_payment_date?: string;
  reminders_sent?: number;
  salesperson_id?: string;
  salesperson_name?: string;
  email?: string;
  phone?: string;
  billing_address?: any;
  shipping_address?: any;
  currency_code?: string;
  currency_symbol?: string;
  invoice_url?: string;
  is_emailed?: boolean;
  is_viewed_by_client?: boolean;
  created_time?: string;
  last_modified_time?: string;
  [key: string]: any; // For any additional fields from Firebase
}

type StatusFilter = 'all' | 'paid' | 'unpaid' | 'overdue';
type SortBy = 'date' | 'due_date' | 'amount' | 'customer';

export default function InvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const navigate = useNavigate();

  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    fetchInvoices();
  }, [currentUserId]);

 const fetchInvoices = async () => {
  try {
    setLoading(true);
    
    // Get user role
    const userDoc = await getDoc(doc(db, 'users', currentUserId || ''));
    const userRole = userDoc.data()?.role;
    const userZohoId = userDoc.data()?.zohospID || userDoc.data()?.zohoAgentID;
    
    let invoicesData: Invoice[] = [];
    
    if (userRole !== 'brandManager' && userZohoId) {
      // For agents: First get their orders to find customer IDs
      const ordersSnapshot = await getDocs(
        query(
          collection(db, 'salesorders'),
          where('salesperson_id', '==', userZohoId)
        )
      );
      
      // Extract unique customer IDs from agent's orders
      const agentCustomerIds = new Set<string>();
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.customer_id) {
          agentCustomerIds.add(data.customer_id);
        }
      });
      
      if (agentCustomerIds.size > 0) {
        // Fetch invoices for these customers
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        invoicesData = invoicesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Invoice))
          .filter(invoice => agentCustomerIds.has(invoice.customer_id));
      }
    } else {
      // For brand managers: get all invoices
      const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
      invoicesData = invoicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Invoice));
    }
    
    setInvoices(invoicesData);
  } catch (error) {
    console.error('Error fetching invoices:', error);
  } finally {
    setLoading(false);
  }
};

  // Calculate if invoice is overdue
  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid') return false;
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    return dueDate < today;
  };

  // Calculate days overdue
  const getDaysOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid') return 0;
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Calculate metrics
const metrics = useMemo(() => {
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.balance || inv.total || 0), 0);
  
  const overdueInvoices = invoices.filter(inv => isOverdue(inv));
  
  // Calculate paid this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const paidThisMonth = invoices
    .filter(inv => {
      if (inv.status !== 'paid' || !inv.last_payment_date) return false;
      const paymentDate = new Date(inv.last_payment_date);
      return paymentDate >= startOfMonth;
    })
    .reduce((sum, inv) => sum + (inv.total || 0), 0);
  
  return {
    totalOutstanding,
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce((sum, inv) => sum + (inv.balance || inv.total || 0), 0),
    paidThisMonth
  };
}, [invoices]);

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices;
    
    // Apply search filter
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.customer_name?.toLowerCase().includes(term) ||
        inv.company_name?.toLowerCase().includes(term) ||
        inv.email?.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => {
        if (statusFilter === 'paid') return inv.status === 'paid';
        if (statusFilter === 'unpaid') return inv.status !== 'paid';
        if (statusFilter === 'overdue') return isOverdue(inv);
        return true;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'due_date':
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        case 'amount':
          return b.total - a.total;
        case 'customer':
          return (a.customer_name || '').localeCompare(b.customer_name || '');
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [invoices, search, statusFilter, sortBy]);

const formatCurrency = (amount: number | undefined | null, currencySymbol = '£') => {
  // Handle undefined, null, or invalid values
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `${currencySymbol}0.00`;
  }
  return `${currencySymbol}${amount.toFixed(2)}`;
};

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch {
      return 'Invalid Date';
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    navigate(`/invoice/${invoice.invoice_id}`);
  };

  const handleViewCustomer = (invoice: Invoice) => {
    navigate(`/customer/${invoice.customer_id}`);
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    if (invoice.invoice_url) {
      window.open(invoice.invoice_url, '_blank');
    }
  };

  const handleEmailInvoice = (invoice: Invoice) => {
    // Implement email functionality
    console.log('Email invoice:', invoice.invoice_number);
  };

  const getStatusClass = (invoice: Invoice) => {
    if (invoice.status === 'paid') return 'status-paid';
    if (isOverdue(invoice)) return 'status-overdue';
    return 'status-pending';
  };

  if (loading) {
    return (
      <div className="invoices-loading">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
        <p>Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="invoices-container">
      <div className="invoices-header">
        <h1>Invoices</h1>
      </div>

      {/* Metric Cards */}
      <div className="invoices-metrics">
        <div className="metric-card">
          <div className="metric-value">{formatCurrency(metrics.totalOutstanding)}</div>
          <div className="metric-label">Total Outstanding</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{metrics.overdueCount}</div>
          <div className="metric-label">Overdue Invoices</div>
          <div className="metric-sublabel">{formatCurrency(metrics.overdueAmount)}</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-value">{formatCurrency(metrics.paidThisMonth)}</div>
          <div className="metric-label">Paid This Month</div>
        </div>
      </div>

      {/* Search and Filter Toolbar */}
      <div className="invoices-toolbar">
        <div className="search-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by invoice number, customer, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <div className="filter-wrapper">
            <FaFilter className="filter-icon" />
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="sort-wrapper">
            <select 
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="date">Sort by Date</option>
              <option value="due_date">Sort by Due Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="customer">Sort by Customer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="invoices-list-view">
        {filteredAndSortedInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No invoices found</h3>
            <p>Try adjusting your filters</p>
          </div>
        ) : (
          filteredAndSortedInvoices.map((invoice) => {
            const daysOverdue = getDaysOverdue(invoice);
            
            return (
              <div key={invoice.invoice_id} className="invoice-list-item">
                <div className="invoice-icon">
                  <FaFileInvoice />
                </div>

                <div className="invoice-info">
                  <div className="invoice-header-row">
                    <div className="invoice-number">{invoice.invoice_number}</div>
                    <div className={`invoice-status ${getStatusClass(invoice)}`}>
                      {invoice.status === 'paid' ? 'Paid' : 
                       isOverdue(invoice) ? `Overdue (${daysOverdue} days)` : 
                       'Unpaid'}
                    </div>
                  </div>
                  <div className="invoice-details">
                    <span className="invoice-customer">{invoice.customer_name || invoice.company_name}</span>
                    <span className="invoice-separator">•</span>
                    <span className="invoice-date">Issued: {formatDate(invoice.date)}</span>
                    <span className="invoice-separator">•</span>
                    <span className="invoice-due">Due: {formatDate(invoice.due_date)}</span>
                  </div>
                  {invoice.email && (
                    <div className="invoice-contact">
                      <span className="invoice-email">{invoice.email}</span>
                    </div>
                  )}
                </div>

                <div className="invoice-amount-section">
                  <div className="invoice-amount">
                    {formatCurrency(invoice.total, invoice.currency_symbol)}
                  </div>
                  {invoice.balance > 0 && invoice.status !== 'paid' && (
                    <div className="invoice-balance">
                      Balance: {formatCurrency(invoice.balance, invoice.currency_symbol)}
                    </div>
                  )}
                  {invoice.reminders_sent > 0 && invoice.status !== 'paid' && (
                    <div className="invoice-reminders">
                      <FaExclamationTriangle /> {invoice.reminders_sent} reminder{invoice.reminders_sent > 1 ? 's' : ''} sent
                    </div>
                  )}
                </div>

                <div className="invoice-actions">
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewInvoice(invoice)}
                    title="View Invoice"
                  >
                    <FaFileInvoice /> View
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleViewCustomer(invoice)}
                    title="View Customer"
                  >
                    <FaUser /> Customer
                  </button>
                  <button 
                    className="action-btn secondary"
                    onClick={() => handleDownloadInvoice(invoice)}
                    title="Download Invoice"
                  >
                    <FaDownload /> Download
                  </button>
                  <button 
                    className="action-btn primary"
                    onClick={() => handleEmailInvoice(invoice)}
                    title="Email Invoice"
                  >
                    <FaEnvelope /> Email
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