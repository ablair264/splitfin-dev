// src/components/CustomerApproval/CustomerApproval.tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import './CustomerApproval.css';

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
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  isExistingCustomer: boolean;
  existingCustomerId?: string;
}

export default function CustomerApproval() {
  const [pendingCustomers, setPendingCustomers] = useState<PendingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<PendingCustomer | null>(null);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'decline' | 'pending' | null;
    message: string;
  }>({
    isOpen: false,
    action: null,
    message: ''
  });
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingCustomers();
  }, []);
  
  const [approvalResult, setApprovalResult] = useState<{
  show: boolean;
  email: string;
  password: string;
  success: boolean;
} | null>(null);


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
      
      setPendingCustomers(customers.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Error fetching pending customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAction = (customer: PendingCustomer, action: 'approve' | 'decline' | 'pending') => {
    setSelectedCustomer(customer);
    setActionModal({
      isOpen: true,
      action,
      message: ''
    });
  };

const processAction = async () => {
  if (!selectedCustomer || !actionModal.action) return;
  
  setProcessing(true);
  
  try {
    const updateData: any = {
      status: actionModal.action === 'approve' ? 'approved' : 
              actionModal.action === 'decline' ? 'declined' : 'pending',
      reviewedBy: auth.currentUser?.uid,
      reviewedAt: new Date().toISOString(),
      reviewMessage: actionModal.message
    };
    
    // Update pending customer status
    await updateDoc(doc(db, 'pending_customers', selectedCustomer.id), updateData);
    
    if (actionModal.action === 'approve') {
      const tempPassword = generateRandomPassword();
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      
      // Create Firebase Auth user using your existing endpoint
      let authUid;
      try {
        const authResponse = await fetch(`${apiUrl}/oauth/create-customer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: selectedCustomer.email,
            password: tempPassword
          })
        });
        
        if (!authResponse.ok) {
          const errorData = await authResponse.json();
          throw new Error(errorData.error || 'Failed to create auth user');
        }
        
        const authData = await authResponse.json();
        authUid = authData.uid;
        
        console.log('✅ Firebase Auth user created with UID:', authUid);
        
      } catch (authError) {
        console.error('Failed to create Firebase Auth user:', authError);
        alert(`Failed to create user account: ${authError.message}`);
        setProcessing(false);
        return;
      }
      
      // Now create/update the Firestore documents using the auth UID
      const userDocRef = doc(db, 'users', authUid); // Use auth UID as document ID
      
      let linkedCustomerId: string | null = null;

try {
  const q = query(
    collection(db, 'customer_data'),
    where('email', '==', selectedCustomer.email.toLowerCase()) // ensure case-insensitive match
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const matchedDoc = snapshot.docs[0];
    linkedCustomerId = matchedDoc.id;
    console.log('✅ Matched Zoho customer_data record:', linkedCustomerId);
  } else {
    console.log('❌ No match found in customer_data for', selectedCustomer.email);
  }
} catch (err) {
  console.error('Error checking Zoho customer_data:', err);
}

await setDoc(userDocRef, {
  uid: authUid,
  name: selectedCustomer.companyName,
  email: selectedCustomer.email,
  role: 'customer',
  isOnline: false,
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  customer_id: linkedCustomerId || null // ✅ store it even if null
});
      
      // Create or update customer record
      let customerDocId;
      if (!selectedCustomer.existingCustomerId) {
        const customerDocRef = await addDoc(collection(db, 'customers'), {
          email: selectedCustomer.email,
          customer_name: selectedCustomer.companyName,
          Primary_First_Name: selectedCustomer.contactName.split(' ')[0] || '',
          Primary_Last_Name: selectedCustomer.contactName.split(' ').slice(1).join(' ') || '',
          Primary_Email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          billing_address: [selectedCustomer.address],
          company: selectedCustomer.companyName,
          vatNumber: selectedCustomer.vatNumber || '',
          website: selectedCustomer.website || '',
          createdAt: new Date().toISOString(),
          userId: authUid, // Link to auth user
          authUid: authUid,
          tempPasswordSet: true,
          passwordLastReset: new Date().toISOString()
        });
        customerDocId = customerDocRef.id;
      } else {
        customerDocId = selectedCustomer.existingCustomerId;
        // Update existing customer with userId
        await updateDoc(doc(db, 'customers', customerDocId), {
          userId: authUid,
          authUid: authUid,
          tempPasswordSet: true,
          passwordLastReset: new Date().toISOString()
        });
      }
      
      // Send approval email with login details
      let emailSent = false;
      try {
        const response = await fetch(`${apiUrl}/api/email/customer-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: selectedCustomer.email,
            status: 'approved',
            tempPassword: tempPassword,
            loginUrl: `${window.location.origin}/customer/login`,
            companyName: selectedCustomer.companyName,
            contactName: selectedCustomer.contactName
          })
        });
        
        if (!response.ok) {
          throw new Error(`Email API returned ${response.status}`);
        }
        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
      }
      
      // Show copyable result
      setApprovalResult({
        show: true,
        email: selectedCustomer.email,
        password: tempPassword,
        success: emailSent
      });
      
      // Create approval notification
      await addDoc(collection(db, 'notifications'), {
        type: 'customer_signup_processed',
        recipientId: auth.currentUser?.uid,
        title: 'Customer Approved',
        message: `${selectedCustomer.companyName} has been approved.`,
        createdAt: new Date().toISOString(),
        read: false
      });
      
    } else {
      // For decline/pending - existing code...
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      
      try {
        const response = await fetch(`${apiUrl}/api/email/customer-approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: selectedCustomer.email,
            status: actionModal.action,
            message: actionModal.message,
            companyName: selectedCustomer.companyName,
            contactName: selectedCustomer.contactName
          })
        });
        
        if (!response.ok) {
          throw new Error(`Email API returned ${response.status}`);
        }
        
        console.log(`${actionModal.action} email sent successfully`);
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        alert(`Status updated but failed to send email notification. Please contact the customer manually.`);
      }
      
      // Create status update notification
      await addDoc(collection(db, 'notifications'), {
        type: 'customer_signup_processed',
        recipientId: auth.currentUser?.uid,
        title: `Customer ${actionModal.action === 'decline' ? 'Declined' : 'Kept Pending'}`,
        message: `${selectedCustomer.companyName} status updated to ${actionModal.action}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    }
    
    // Refresh the list
    await fetchPendingCustomers();
    
setActionModal({ isOpen: false, action: null, message: '' });
    setSelectedCustomer(null);
    
  } catch (error) {
    console.error('Error processing action:', error);
    alert('Failed to process action. Please try again.');
  } finally {
    setProcessing(false);
  }
};

// Add copy function
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
};


  if (loading) {
    return <div className="loading">Loading pending customers...</div>;
  }

  return (
    <div className="customer-approval-container">
      <header className="approval-header">
        <h1>Customer Signup Requests</h1>
        <p>Review and approve customer access requests</p>
      </header>

      {pendingCustomers.length === 0 ? (
        <div className="no-requests">
          <p>No pending customer requests</p>
        </div>
      ) : (
        <div className="requests-grid">
          {pendingCustomers.map(customer => (
            <div key={customer.id} className="request-card">
              <div className="request-header">
                <h3>{customer.companyName}</h3>
                {customer.isExistingCustomer && (
                  <span className="existing-badge">Existing Customer</span>
                )}
              </div>
              
              <div className="request-details">
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
                <div className="detail-row">
                  <span className="label">Requested:</span>
                  <span>{new Date(customer.createdAt).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="action-buttons">
                <button
                  className="approve-btn"
                  onClick={() => handleAction(customer, 'approve')}
                >
                  Approve
                </button>
                <button
                  className="pending-btn"
                  onClick={() => handleAction(customer, 'pending')}
                >
                  Keep Pending
                </button>
                <button
                  className="decline-btn"
                  onClick={() => handleAction(customer, 'decline')}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setActionModal({ isOpen: false, action: null, message: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>
              {actionModal.action === 'approve' && 'Approve Customer'}
              {actionModal.action === 'decline' && 'Decline Customer'}
              {actionModal.action === 'pending' && 'Keep Customer Pending'}
            </h2>
            
            <div className="modal-info">
              <p><strong>Customer:</strong> {selectedCustomer?.companyName}</p>
              <p><strong>Contact:</strong> {selectedCustomer?.contactName}</p>
              <p><strong>Email:</strong> {selectedCustomer?.email}</p>
            </div>
            
            {actionModal.action === 'approve' ? (
              <div className="approval-notice">
                <p>Approving this customer will:</p>
                <ul>
                  <li>Create a login account for them</li>
                  <li>Generate a temporary password</li>
                  <li>Send them a welcome email with login instructions</li>
                  {selectedCustomer?.isExistingCustomer && (
                    <li>Link their account to existing customer record</li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="form-group">
                <label>Message (Optional)</label>
                <textarea
                  value={actionModal.message}
                  onChange={(e) => setActionModal({ ...actionModal, message: e.target.value })}
                  placeholder={
                    actionModal.action === 'decline' 
                      ? "Reason for declining (will be sent to customer)..." 
                      : "Additional notes for keeping pending..."
                  }
                  rows={4}
                />
              </div>
            )}
            
            <div className="modal-actions">
              <button
                onClick={processAction}
                disabled={processing}
                className={`${actionModal.action}-btn`}
              >
                {processing ? 'Processing...' : `Confirm ${actionModal.action}`}
              </button>
              <button
                onClick={() => setActionModal({ isOpen: false, action: null, message: '' })}
                disabled={processing}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {approvalResult?.show && (
  <div className="modal-overlay" onClick={() => setApprovalResult(null)}>
    <div className="modal-content approval-result" onClick={e => e.stopPropagation()}>
      <h2>✅ Customer Approved</h2>
      
      <div className={`email-status ${approvalResult.success ? 'success' : 'warning'}`}>
        {approvalResult.success ? (
          <p>✅ Welcome email sent successfully!</p>
        ) : (
          <p>⚠️ Email failed to send - please send login details manually</p>
        )}
      </div>
      
      <div className="credentials-box">
        <h3>Login Credentials</h3>
        <p className="important-note">
          ⚠️ Save these credentials - they cannot be retrieved later!
        </p>
        
        <div className="credential-item">
          <label>Email:</label>
          <div className="credential-value">
            <code>{approvalResult.email}</code>
            <button 
              className="copy-btn" 
              onClick={() => copyToClipboard(approvalResult.email)}
            >
              📋 Copy
            </button>
          </div>
        </div>
        
        <div className="credential-item">
          <label>Temporary Password:</label>
          <div className="credential-value">
            <code>{approvalResult.password}</code>
            <button 
              className="copy-btn" 
              onClick={() => copyToClipboard(approvalResult.password)}
            >
              📋 Copy
            </button>
          </div>
        </div>
        
        <div className="credential-item">
          <label>Login URL:</label>
          <div className="credential-value">
            <code>{window.location.origin}/customer/login</code>
            <button 
              className="copy-btn" 
              onClick={() => copyToClipboard(`${window.location.origin}/customer/login`)}
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>
      
      <div className="next-steps">
        <h4>Next Steps:</h4>
        <ol>
          <li>Create Firebase Auth account with these credentials</li>
          <li>If email failed, send credentials to customer manually</li>
          <li>Customer should change password on first login</li>
        </ol>
      </div>
      
      <button 
        className="close-btn"
        onClick={() => setApprovalResult(null)}
      >
        Close
      </button>
    </div>
  </div>
)}
    </div>
  );
}