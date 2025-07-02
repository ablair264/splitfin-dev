// src/components/CustomerSignup/CustomerSignup.tsx
import React, { useState } from 'react';
import { addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Link } from 'react-router-dom';
import './CustomerSignup.css';

export default function CustomerSignup() {
  const [formData, setFormData] = useState({
    email: '',
    companyName: '',
    contactName: '',
    phone: '',
    address: '',
    vatNumber: '',
    website: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const checkExistingCustomer = async (email: string, companyName: string) => {
    // Check by email
    const emailQueries = [
      query(collection(db, 'customer_data'), where('email', '==', email)),
      query(collection(db, 'customer_data'), where('Primary_Email', '==', email))
    ];
    
    for (const q of emailQueries) {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { exists: true, doc: snapshot.docs[0] };
      }
    }
    
    // Check by company name
    const companyQueries = [
      query(collection(db, 'customer_data'), where('company_name', '==', companyName)),
      query(collection(db, 'customer_data'), where('customer_name', '==', companyName)),
      query(collection(db, 'customer_data'), where('companyName', '==', companyName))
    ];
    
    for (const q of companyQueries) {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return { exists: true, doc: snapshot.docs[0] };
      }
    }
    
    return { exists: false, doc: null };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check for existing customer
      const existingCustomer = await checkExistingCustomer(formData.email, formData.companyName);
      
      // Check if already has login access
      if (existingCustomer.exists && existingCustomer.doc) {
        const customerData = existingCustomer.doc.data();
        if (customerData.loginid || customerData.firebaseUID) {
          setError('An account with this email/company already exists. Please sign in instead.');
          setLoading(false);
          return;
        }
      }
      
      // Check for pending request
      const pendingQuery = query(
        collection(db, 'pending_customers'),
        where('email', '==', formData.email),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      
      if (!pendingSnapshot.empty) {
        setError('A signup request for this email is already pending review.');
        setLoading(false);
        return;
      }
      
      // Create pending customer request
      const pendingCustomerData = {
        ...formData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        existingCustomerId: existingCustomer.doc?.id || null,
        isExistingCustomer: existingCustomer.exists
      };
      
      const pendingDocRef = await addDoc(collection(db, 'pending_customers'), pendingCustomerData);
      
      // Find sammie@dmbrands.co.uk user by checking auth records
      let sammieUserId = null;
      
      // First try to find in users collection
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', 'sammie@dmbrands.co.uk')
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        sammieUserId = usersSnapshot.docs[0].id;
      } else {
        // If not found in users, check staff_users collection
        const staffQuery = query(
          collection(db, 'staff_users'),
          where('email', '==', 'sammie@dmbrands.co.uk')
        );
        const staffSnapshot = await getDocs(staffQuery);
        if (!staffSnapshot.empty) {
          sammieUserId = staffSnapshot.docs[0].data().uid || staffSnapshot.docs[0].id;
        }
      }
      
      // Create notification for sammie@dmbrands.co.uk specifically
      if (sammieUserId) {
        await addDoc(collection(db, 'notifications'), {
          type: 'customer_signup_request',
          recipientId: sammieUserId,
          recipientEmail: 'sammie@dmbrands.co.uk',
          title: 'New Customer Signup Request',
          message: `${formData.companyName} (${formData.contactName}) has requested a customer account.`,
          createdAt: new Date().toISOString(),
          read: false,
          data: {
            pendingCustomerId: pendingDocRef.id,
            companyName: formData.companyName,
            contactName: formData.contactName,
            email: formData.email,
            isExistingCustomer: existingCustomer.exists
          }
        });
      }
      
      // Also create general notification for all brand managers
      await addDoc(collection(db, 'notifications'), {
        type: 'customer_signup_request',
        recipientRole: 'brandManager',
        title: 'New Customer Signup Request',
        message: `${formData.companyName} has requested a customer account.`,
        createdAt: new Date().toISOString(),
        read: false,
        data: {
          pendingCustomerId: pendingDocRef.id,
          companyName: formData.companyName,
          email: formData.email,
          isExistingCustomer: existingCustomer.exists
        }
      });
      
      // Send email notification to sammie@dmbrands.co.uk
      try {
        const apiUrl = import.meta.env.VITE_API_BASE || 'https://your-api.com';
        await fetch(`${apiUrl}/api/email/customer-signup-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: 'sammie@dmbrands.co.uk',
            pendingCustomer: pendingCustomerData,
            pendingCustomerId: pendingDocRef.id
          })
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
      
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting signup:', error);
      setError('Failed to submit signup request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="signup-success">
        <div className="success-content">
          <h2>✅ Request Submitted!</h2>
          <p>Thank you for your interest in becoming a customer.</p>
          <p>We'll review your application and contact you within 24-48 hours.</p>
          <Link to="/customer/login" className="back-link">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-signup-page">
      <div className="signup-container compact">
        <div className="signup-header">
          <h1>Create Account</h1>
          <p>Join our wholesale platform</p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form compact">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="form-row">
            <div className="form-group">
              <label>Business Email*</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="email@company.com"
              />
            </div>

            <div className="form-group">
              <label>Company Name*</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                required
                placeholder="Your Company Ltd"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Name*</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                required
                placeholder="John Smith"
              />
            </div>

            <div className="form-group">
              <label>Phone*</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                required
                placeholder="+44 20 1234 5678"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>VAT Number</label>
              <input
                type="text"
                value={formData.vatNumber}
                onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                placeholder="GB123456789"
              />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                placeholder="https://yoursite.com"
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Business Address*</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              required
              rows={2}
              placeholder="123 Business Street, London, EC1A 1BB"
            />
          </div>

          <div className="form-group full-width">
            <label>Message (Optional)</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              rows={2}
              placeholder="Tell us about your business..."
            />
          </div>

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>

          <p className="login-link">
            Already have an account? <Link to="/customer/login">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}