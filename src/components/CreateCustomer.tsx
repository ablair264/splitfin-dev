// src/components/CreateCustomer.tsx
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useUser } from './UserContext';
import './CreateCustomer.css';
import { FaCheck, FaEnvelope, FaUserPlus } from 'react-icons/fa';

export default function CreateCustomer() {
  const user = useUser();
  const [activeTab, setActiveTab] = useState<'direct' | 'invite'>('direct');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    contactName: '',
    phone: '',
    address: '',
    vatNumber: '',
    website: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Direct creation (with password)
  const handleDirectCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Create auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Create customer document
      await setDoc(doc(db, 'customer_data', userCredential.user.uid), {
        email: formData.email,
        companyName: formData.companyName,
        contactName: formData.contactName,
        phone: formData.phone,
        address: formData.address,
        vatNumber: formData.vatNumber,
        website: formData.website,
        role: 'customer',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid,
        createdByName: user?.name,
        method: 'direct'
      });

      // Create notification for the customer
      await addDoc(collection(db, 'notifications'), {
        type: 'account_created',
        recipientId: userCredential.user.uid,
        recipientType: 'customer',
        title: 'Welcome to Splitfin!',
        message: `Your account has been created. You can now log in with your email and password.`,
        createdAt: new Date().toISOString(),
        read: false,
        data: {
          companyName: formData.companyName
        }
      });

      setMessage({ type: 'success', text: 'Customer account created successfully!' });
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        companyName: '',
        contactName: '',
        phone: '',
        address: '',
        vatNumber: '',
        website: ''
      });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Invite creation (email invitation)
  const handleInviteCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      
      // Create auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        tempPassword
      );

      // Create customer document
      await setDoc(doc(db, 'customer_data', userCredential.user.uid), {
        email: formData.email,
        companyName: formData.companyName,
        contactName: formData.contactName,
        phone: formData.phone,
        address: formData.address,
        vatNumber: formData.vatNumber,
        website: formData.website,
        role: 'customer',
        isActive: true,
        needsPasswordReset: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid,
        createdByName: user?.name,
        method: 'invite'
      });

      // Send password reset email
      await sendPasswordResetEmail(auth, formData.email, {
        url: 'https://yourdomain.com/customer/login'
      });

      // Create notification
      await addDoc(collection(db, 'notifications'), {
        type: 'account_invitation',
        recipientId: userCredential.user.uid,
        recipientType: 'customer',
        title: 'Welcome to Splitfin!',
        message: `An account has been created for ${formData.companyName}. Check your email to set your password.`,
        createdAt: new Date().toISOString(),
        read: false,
        email: formData.email
      });

      setMessage({ 
        type: 'success', 
        text: 'Customer account created and invitation email sent!' 
      });
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        companyName: '',
        contactName: '',
        phone: '',
        address: '',
        vatNumber: '',
        website: ''
      });
    } catch (error: any) {
      console.error('Error inviting customer:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'brandManager') {
    return (
      <div className="unauthorized">
        <h2>Unauthorized</h2>
        <p>Only brand managers can create customer accounts.</p>
      </div>
    );
  }

  return (
    <div className="create-customer-page">
      <div className="create-customer-header">
        <h1>Create Customer Account</h1>
        <p>Add a new customer to the system</p>
      </div>

      <div className="create-customer-container">
        <div className="tab-selector">
          <button
            className={`tab-button ${activeTab === 'direct' ? 'active' : ''}`}
            onClick={() => setActiveTab('direct')}
          >
            <FaUserPlus /> Direct Creation
          </button>
          <button
            className={`tab-button ${activeTab === 'invite' ? 'active' : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            <FaEnvelope /> Email Invitation
          </button>
        </div>

        {message && (
          <div className={`message ${message.type}`}>
            <FaCheck /> {message.text}
          </div>
        )}

        <form onSubmit={activeTab === 'direct' ? handleDirectCreate : handleInviteCreate}>
          <div className="form-grid">
            <div className="form-group">
              <label>Email Address*</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="customer@example.com"
              />
            </div>

            {activeTab === 'direct' && (
              <div className="form-group">
                <label>Password*</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                />
              </div>
            )}

            <div className="form-group">
              <label>Company Name*</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                required
                placeholder="Acme Corporation"
              />
            </div>

            <div className="form-group">
              <label>Contact Name*</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                required
                placeholder="John Doe"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+44 123 456 7890"
              />
            </div>

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
                placeholder="https://example.com"
              />
            </div>

            <div className="form-group full-width">
              <label>Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows={3}
                placeholder="123 Main Street&#10;London&#10;SW1A 1AA"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Creating...' : 
                activeTab === 'direct' ? 'Create Account' : 'Send Invitation'
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}