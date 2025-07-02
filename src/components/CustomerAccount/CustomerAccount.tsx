// src/components/CustomerAccount/CustomerAccount.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../../firebase';
import '../CustomerDashboard/CustomerDashboard.css';

interface AccountInfo {
  companyName: string;
  email: string;
  contactName: string;
  phone: string;
  address: string;
}

export default function CustomerAccount() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    companyName: '',
    email: '',
    contactName: '',
    phone: '',
    address: ''
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    try {
      if (!auth.currentUser) return;
      
      const docRef = doc(db, 'customer_data', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAccountInfo({
          companyName: data.companyName || '',
          email: data.email || auth.currentUser.email || '',
          contactName: data.contactName || '',
          phone: data.phone || '',
          address: data.address || ''
        });
      }
    } catch (error) {
      console.error('Error fetching account info:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!auth.currentUser) return;
      
      await updateDoc(doc(db, 'customer_data', auth.currentUser.uid), {
        ...accountInfo,
        updatedAt: new Date().toISOString()
      });
      
      setEditing(false);
    } catch (error) {
      console.error('Error saving account info:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="customer-account">
      <h1>My Account</h1>
      
      <div className="account-section">
        <h2>Account Information</h2>
        
        <div className="account-form">
          <div className="form-group">
            <label>Company Name</label>
            <input
              type="text"
              value={accountInfo.companyName}
              onChange={(e) => setAccountInfo({ ...accountInfo, companyName: e.target.value })}
              disabled={!editing}
            />
          </div>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={accountInfo.email}
              disabled
            />
          </div>
          
          <div className="form-group">
            <label>Contact Name</label>
            <input
              type="text"
              value={accountInfo.contactName}
              onChange={(e) => setAccountInfo({ ...accountInfo, contactName: e.target.value })}
              disabled={!editing}
            />
          </div>
          
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={accountInfo.phone}
              onChange={(e) => setAccountInfo({ ...accountInfo, phone: e.target.value })}
              disabled={!editing}
            />
          </div>
          
          <div className="form-group">
            <label>Address</label>
            <textarea
              value={accountInfo.address}
              onChange={(e) => setAccountInfo({ ...accountInfo, address: e.target.value })}
              disabled={!editing}
              rows={3}
            />
          </div>
          
          <div className="form-actions">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="cancel-btn">Cancel</button>
                <button onClick={handleSave} className="save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="edit-btn">Edit Information</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}