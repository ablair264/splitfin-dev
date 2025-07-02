// src/components/CustomerPayInvoice/CustomerPayInvoice.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { FaCreditCard, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import './CustomerPayInvoice.css';

interface DueInvoice {
  invoice_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_symbol: string;
  overdue: boolean;
  days_overdue?: number;
}

interface CustomerData {
  customer_id: string;
  customer_name?: string;
  email?: string;
  company_name?: string;
}

export default function CustomerPayInvoice() {
  const [dueInvoices, setDueInvoices] = useState<DueInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomerAndDueInvoices();
  }, []);

  const fetchCustomerAndDueInvoices = async () => {
    try {
      setError(null);
      if (!auth.currentUser) {
        setError('Please log in to view invoices');
        return;
      }

      // First, fetch the customer data
      const customerDoc = await getDoc(doc(db, 'customer_data', auth.currentUser.uid));
      
      if (!customerDoc.exists()) {
        setError('Customer profile not found. Please contact support.');
        return;
      }

      const customerInfo = customerDoc.data() as CustomerData;
      setCustomerData(customerInfo);

      // Now fetch unpaid invoices using the customer_id
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('customer_id', '==', customerInfo.customer_id),
        where('balance', '>', 0),
        orderBy('due_date', 'asc')
      );

      const snapshot = await getDocs(invoicesQuery);
      const invoicesList = snapshot.docs.map(doc => {
        const data = doc.data();
        const dueDate = new Date(data.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        
        return {
          ...data,
          overdue: dueDate < today,
          days_overdue: daysOverdue
        } as DueInvoice;
      });

      setDueInvoices(invoicesList);
    } catch (error) {
      console.error('Error fetching due invoices:', error);
      setError('Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedInvoices.size === dueInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(dueInvoices.map(inv => inv.invoice_id)));
    }
  };

  const getTotalSelected = () => {
    return dueInvoices
      .filter(inv => selectedInvoices.has(inv.invoice_id))
      .reduce((sum, inv) => sum + inv.balance, 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number, symbol: string = '£') => {
    return `${symbol}${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="pay-invoice-loading">
        <div className="loading-spinner"></div>
        <p>Loading outstanding invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pay-invoice-error">
        <FaExclamationTriangle className="error-icon" />
        <h3>Unable to Load Invoices</h3>
        <p>{error}</p>
        <button onClick={fetchCustomerAndDueInvoices} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  if (dueInvoices.length === 0) {
    return (
      <div className="no-due-invoices">
        <FaCreditCard className="empty-icon" />
        <h2>No Outstanding Invoices</h2>
        <p>All your invoices have been paid. Thank you!</p>
      </div>
    );
  }

  // Separate overdue and current invoices
  const overdueInvoices = dueInvoices.filter(inv => inv.overdue);
  const currentInvoices = dueInvoices.filter(inv => !inv.overdue);

  return (
    <div className="customer-pay-invoice">
      <div className="pay-invoice-header">
        <h1>Pay Outstanding Invoices</h1>
        {customerData && (
          <p className="customer-subtitle">
            {customerData.company_name || customerData.customer_name}
          </p>
        )}
        <div className="header-info">
          <FaInfoCircle />
          <span>Select invoices to pay online</span>
        </div>
      </div>

      {overdueInvoices.length > 0 && (
        <div className="overdue-alert">
          <FaExclamationTriangle />
          <span>You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="invoices-summary">
        <div className="summary-item">
          <span className="summary-label">Total Outstanding:</span>
          <span className="summary-value">
            {formatCurrency(dueInvoices.reduce((sum, inv) => sum + inv.balance, 0))}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Selected Amount:</span>
          <span className="summary-value selected">
            {formatCurrency(getTotalSelected())}
          </span>
        </div>
        {overdueInvoices.length > 0 && (
          <div className="summary-item">
            <span className="summary-label">Overdue Amount:</span>
            <span className="summary-value overdue">
              {formatCurrency(overdueInvoices.reduce((sum, inv) => sum + inv.balance, 0))}
            </span>
          </div>
        )}
      </div>

      <div className="due-invoices-table">
        <div className="table-header">
          <label className="select-all">
            <input
              type="checkbox"
              checked={selectedInvoices.size === dueInvoices.length && dueInvoices.length > 0}
              onChange={handleSelectAll}
            />
            <span>Select All</span>
          </label>
        </div>

        <div className="invoices-list">
          {/* Show overdue invoices first */}
          {overdueInvoices.length > 0 && (
            <>
              <div className="section-divider">Overdue Invoices</div>
              {overdueInvoices.map(invoice => (
                <InvoiceRow 
                  key={invoice.invoice_id} 
                  invoice={invoice}
                  selected={selectedInvoices.has(invoice.invoice_id)}
                  onSelect={() => handleSelectInvoice(invoice.invoice_id)}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                />
              ))}
            </>
          )}
          
          {/* Then show current invoices */}
          {currentInvoices.length > 0 && (
            <>
              {overdueInvoices.length > 0 && <div className="section-divider">Current Invoices</div>}
              {currentInvoices.map(invoice => (
                <InvoiceRow 
                  key={invoice.invoice_id} 
                  invoice={invoice}
                  selected={selectedInvoices.has(invoice.invoice_id)}
                  onSelect={() => handleSelectInvoice(invoice.invoice_id)}
                  formatDate={formatDate}
                  formatCurrency={formatCurrency}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {selectedInvoices.size > 0 && (
        <div className="payment-section">
          <button className="pay-now-btn">
            <FaCreditCard />
            Pay {formatCurrency(getTotalSelected())} Now
          </button>
          <p className="payment-info">
            You will be redirected to our secure payment portal
          </p>
        </div>
      )}
    </div>
  );
}

// Invoice Row Component
interface InvoiceRowProps {
  invoice: DueInvoice;
  selected: boolean;
  onSelect: () => void;
  formatDate: (date: string) => string;
  formatCurrency: (amount: number, symbol?: string) => string;
}

function InvoiceRow({ invoice, selected, onSelect, formatDate, formatCurrency }: InvoiceRowProps) {
  return (
    <div className={`due-invoice-row ${invoice.overdue ? 'overdue' : ''}`}>
      <label className="invoice-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
        />
      </label>

      <div className="invoice-info">
        <div className="invoice-main">
          <span className="invoice-number">{invoice.invoice_number}</span>
          <span className="invoice-date">Issued: {formatDate(invoice.date)}</span>
        </div>
        <div className="invoice-due">
          <span className="due-date">Due: {formatDate(invoice.due_date)}</span>
          {invoice.overdue && invoice.days_overdue && invoice.days_overdue > 0 && (
            <span className="overdue-badge">
              {invoice.days_overdue} day{invoice.days_overdue > 1 ? 's' : ''} overdue
            </span>
          )}
        </div>
      </div>

      <div className="invoice-amount">
        <span className="amount">{formatCurrency(invoice.balance, invoice.currency_symbol)}</span>
      </div>
    </div>
  );
}