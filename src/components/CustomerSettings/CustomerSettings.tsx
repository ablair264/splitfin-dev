// src/components/CustomerSettings/CustomerSettings.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  FaSave, 
  FaUser, 
  FaBuilding, 
  FaEnvelope, 
  FaPhone, 
  FaMapMarkerAlt,
  FaGlobe,
  FaIdCard,
  FaUpload,
  FaSpinner
} from 'react-icons/fa';
import './CustomerSettings.css';

interface CustomerData {
  customer_id: string;
  customer_name: string;
  company_name?: string;
  email: string;
  Primary_Email?: string;
  phone?: string;
  mobile?: string;
  billing_address?: {
    address?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  shipping_address?: {
    address?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  website?: string;
  vat_treatment?: string;
  vat_reg_no?: string;
  currency_code?: string;
  payment_terms?: number;
  notes?: string;
  company_logo?: string;
  contact_persons?: Array<{
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
  }>;
}

export default function CustomerSettings() {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
      if (!auth.currentUser) {
        setError('Please log in to view settings');
        return;
      }

      const docRef = doc(db, 'customer_data', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setCustomerData(docSnap.data() as CustomerData);
      } else {
        setError('Customer profile not found');
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setUploadingLogo(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `customer-logos/${auth.currentUser.uid}/${file.name}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const logoUrl = await getDownloadURL(snapshot.ref);
      
      setCustomerData(prev => prev ? { ...prev, company_logo: logoUrl } : null);
      setSuccess('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      setError('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setCustomerData(prev => {
      if (!prev) return null;
      
      // Handle nested fields
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...(prev[parent as keyof CustomerData] as any || {}),
            [child]: value
          }
        };
      }
      
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!customerData || !auth.currentUser) return;
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update Firebase
      const docRef = doc(db, 'customer_data', auth.currentUser.uid);
      await updateDoc(docRef, {
        ...customerData,
        last_updated: new Date().toISOString()
      });
      
      // Update Zoho via API
      const apiUrl = import.meta.env.VITE_API_BASE || 'https://splitfin-zoho-api.onrender.com';
      const response = await fetch(`${apiUrl}/api/customers/${customerData.customer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerData.customer_name,
          company_name: customerData.company_name,
          email: customerData.email,
          phone: customerData.phone,
          mobile: customerData.mobile,
          website: customerData.website,
          billing_address: customerData.billing_address,
          shipping_address: customerData.shipping_address,
          vat_treatment: customerData.vat_treatment,
          vat_reg_no: customerData.vat_reg_no,
          currency_code: customerData.currency_code,
          payment_terms: customerData.payment_terms,
          notes: customerData.notes
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update Zoho');
      }
      
      setSuccess('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <FaSpinner className="spinner" />
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="settings-error">
        <p>{error || 'Unable to load settings'}</p>
      </div>
    );
  }

  return (
    <div className="customer-settings-container">
      <header className="settings-header">
        <h1>Account Settings</h1>
        <p>Manage your company profile and preferences</p>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="settings-content">
        <div className="settings-tabs">
          <button 
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <FaBuilding /> General Info
          </button>
          <button 
            className={`tab ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            <FaPhone /> Contact Details
          </button>
          <button 
            className={`tab ${activeTab === 'addresses' ? 'active' : ''}`}
            onClick={() => setActiveTab('addresses')}
          >
            <FaMapMarkerAlt /> Addresses
          </button>
          <button 
            className={`tab ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <FaIdCard /> Billing & Tax
          </button>
        </div>

        <div className="settings-panel">
          {activeTab === 'general' && (
            <div className="tab-content">
              <h2>General Information</h2>
              
              <div className="logo-section">
                <label>Company Logo</label>
                <div className="logo-upload">
                  {customerData.company_logo ? (
                    <img src={customerData.company_logo} alt="Company logo" className="current-logo" />
                  ) : (
                    <div className="logo-placeholder">
                      <FaBuilding />
                    </div>
                  )}
                  <div className="upload-controls">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="file-input"
                    />
                    <label htmlFor="logo-upload" className="upload-btn">
                      {uploadingLogo ? <FaSpinner className="spinner" /> : <FaUpload />}
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </label>
                    <p className="upload-hint">Recommended: 200x200px, PNG or JPG</p>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={customerData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="Your Company Ltd"
                  />
                </div>

                <div className="form-group">
                  <label>Contact Name</label>
                  <input
                    type="text"
                    value={customerData.customer_name || ''}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    placeholder="John Smith"
                  />
                </div>

                <div className="form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    value={customerData.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div className="form-group">
                  <label>Customer ID</label>
                  <input
                    type="text"
                    value={customerData.customer_id || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={customerData.notes || ''}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  placeholder="Any additional information..."
                />
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="tab-content">
              <h2>Contact Information</h2>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Primary Email</label>
                  <input
                    type="email"
                    value={customerData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@company.com"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={customerData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+44 20 1234 5678"
                  />
                </div>

                <div className="form-group">
                  <label>Mobile</label>
                  <input
                    type="tel"
                    value={customerData.mobile || ''}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                    placeholder="+44 7700 900000"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'addresses' && (
            <div className="tab-content">
              <h2>Addresses</h2>
              
              <div className="address-section">
                <h3>Billing Address</h3>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={customerData.billing_address?.address || ''}
                      onChange={(e) => handleInputChange('billing_address.address', e.target.value)}
                      placeholder="123 Business Street"
                    />
                  </div>

                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={customerData.billing_address?.city || ''}
                      onChange={(e) => handleInputChange('billing_address.city', e.target.value)}
                      placeholder="London"
                    />
                  </div>

                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={customerData.billing_address?.zip || ''}
                      onChange={(e) => handleInputChange('billing_address.zip', e.target.value)}
                      placeholder="EC1A 1BB"
                    />
                  </div>

                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={customerData.billing_address?.country || ''}
                      onChange={(e) => handleInputChange('billing_address.country', e.target.value)}
                      placeholder="United Kingdom"
                    />
                  </div>
                </div>
              </div>

              <div className="address-section">
                <h3>Shipping Address</h3>
                <button 
                  className="copy-address-btn"
                  onClick={() => setCustomerData(prev => prev ? {
                    ...prev,
                    shipping_address: prev.billing_address
                  } : null)}
                >
                  Same as billing address
                </button>
                
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Street Address</label>
                    <input
                      type="text"
                      value={customerData.shipping_address?.address || ''}
                      onChange={(e) => handleInputChange('shipping_address.address', e.target.value)}
                      placeholder="123 Warehouse Road"
                    />
                  </div>

                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={customerData.shipping_address?.city || ''}
                      onChange={(e) => handleInputChange('shipping_address.city', e.target.value)}
                      placeholder="London"
                    />
                  </div>

                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      value={customerData.shipping_address?.zip || ''}
                      onChange={(e) => handleInputChange('shipping_address.zip', e.target.value)}
                      placeholder="EC1A 1BB"
                    />
                  </div>

                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      value={customerData.shipping_address?.country || ''}
                      onChange={(e) => handleInputChange('shipping_address.country', e.target.value)}
                      placeholder="United Kingdom"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="tab-content">
              <h2>Billing & Tax Information</h2>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>VAT Number</label>
                  <input
                    type="text"
                    value={customerData.vat_reg_no || ''}
                    onChange={(e) => handleInputChange('vat_reg_no', e.target.value)}
                    placeholder="GB123456789"
                  />
                </div>

                <div className="form-group">
                  <label>VAT Treatment</label>
                  <select
                    value={customerData.vat_treatment || ''}
                    onChange={(e) => handleInputChange('vat_treatment', e.target.value)}
                  >
                    <option value="">Select VAT Treatment</option>
                    <option value="vat_registered">VAT Registered</option>
                    <option value="vat_not_registered">Not VAT Registered</option>
                    <option value="consumer">Consumer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={customerData.currency_code || 'GBP'}
                    onChange={(e) => handleInputChange('currency_code', e.target.value)}
                  >
                    <option value="GBP">GBP - British Pound</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - US Dollar</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={customerData.payment_terms || 30}
                    onChange={(e) => handleInputChange('payment_terms', parseInt(e.target.value))}
                    min="0"
                    max="365"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-actions">
          <button 
            className="save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <FaSpinner className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <FaSave />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}