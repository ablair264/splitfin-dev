import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { useUser } from '../UserContext';
import './PendingCustomers.css';

interface PendingCustomer {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  phone: string;
  address: string;
  vatNumber?: string;
  website?: string;
  message?: string;
  status: string;
  createdAt: string;
}

export default function PendingCustomers() {
  const user = useUser();
  const [pendingCustomers, setPendingCustomers] = useState<PendingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCustomers();
  }, []);

  const fetchPendingCustomers = async () => {
    try {
      const q = query(
        collection(db, 'pending_customers'),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const customers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingCustomer));
      
      setPendingCustomers(customers);
    } catch (error) {
      console.error('Error fetching pending customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveCustomer = async (customer: PendingCustomer) => {
    setProcessing(customer.id);
    
    try {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      
      // Create auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        customer.email, 
        tempPassword
      );

      // Create customer document
      await setDoc(doc(db, 'customer_data', userCredential.user.uid), {
        email: customer.email,
        companyName: customer.companyName,
        contactName: customer.contactName,
        phone: customer.phone,
        address: customer.address,
        vatNumber: customer.vatNumber,
        website: customer.website,
        role: 'customer',
        isActive: true,
        needsPasswordReset: true,
        createdAt: new Date().toISOString(),
        approvedBy: user?.uid,
        approvedByName: user?.name
      });

      // Send password reset email
      await sendPasswordResetEmail(auth, customer.email);

      // Update pending customer status
      await updateDoc(doc(db, 'pending_customers', customer.id), {
        status: 'approved',
        reviewedBy: user?.uid,
        reviewedAt: new Date().toISOString()
      });

      // Create notification
      await addDoc(collection(db, 'notifications'), {
        type: 'account_approved',
        recipientId: userCredential.user.uid,
        recipientType: 'customer',
        title: 'Account Approved!',
        message: 'Your Splitfin account has been approved. Check your email to set your password.',
        createdAt: new Date().toISOString(),
        read: false
      });

      // Refresh the list
      fetchPendingCustomers();
    } catch (error) {
      console.error('Error approving customer:', error);
      alert('Failed to approve customer. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const rejectCustomer = async (customer: PendingCustomer) => {
    if (!confirm(`Are you sure you want to reject ${customer.companyName}?`)) {
      return;
    }

    setProcessing(customer.id);
    
    try {
      // Update status
      await updateDoc(doc(db, 'pending_customers', customer.id), {
        status: 'rejected',
        reviewedBy: user?.uid,
        reviewedAt: new Date().toISOString()
      });

      // Refresh the list
      fetchPendingCustomers();
    } catch (error) {
      console.error('Error rejecting customer:', error);
      alert('Failed to reject customer. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (user?.role !== 'brandManager') {
    return (
      <div className="unauthorized">
        <h2>Unauthorized</h2>
        <p>Only brand managers can review customer applications.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading pending customers...</div>;
  }

  return (
    <div className="pending-customers-page">
      <div className="page-header">
        <h1>Pending Customer Applications</h1>
        <p>{pendingCustomers.length} applications waiting for review</p>
      </div>

      {pendingCustomers.length === 0 ? (
        <div className="empty-state">
          <h3>No pending applications</h3>
          <p>All customer applications have been reviewed.</p>
        </div>
      ) : (
        <div className="applications-grid">
          {pendingCustomers.map(customer => (
            <div key={customer.id} className="application-card">
              <div className="application-header">
                <h3>{customer.companyName}</h3>
                <span className="application-date">
                  {new Date(customer.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="application-details">
                <div className="detail-row">
                  <span className="label">Contact:</span>
                  <span>{customer.contactName}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Email:</span>
                  <span>{customer.email}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Phone:</span>
                  <span>{customer.phone}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Address:</span>
                  <span>{customer.address}</span>
                </div>
                {customer.vatNumber && (
                  <div className="detail-row">
                    <span className="label">VAT:</span>
                    <span>{customer.vatNumber}</span>
                  </div>
                )}
                {customer.website && (
                  <div className="detail-row">
                    <span className="label">Website:</span>
                    <a href={customer.website} target="_blank" rel="noopener noreferrer">
                      {customer.website}
                    </a>
                  </div>
                )}
                {customer.message && (
                  <div className="detail-row full-width">
                    <span className="label">Message:</span>
                    <p>{customer.message}</p>
                  </div>
                )}
              </div>

              <div className="application-actions">
                <button 
                  className="approve-btn"
                  onClick={() => approveCustomer(customer)}
                  disabled={processing === customer.id}
                >
                  {processing === customer.id ? 'Processing...' : 'Approve'}
                </button>
                <button 
                  className="reject-btn"
                  onClick={() => rejectCustomer(customer)}
                  disabled={processing === customer.id}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}