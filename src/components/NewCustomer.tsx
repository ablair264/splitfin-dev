// src/components/NewCustomer.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import './NewCustomer.css';

interface CustomerFormData {
  // Basic Information
  customer_name: string;
  email: string;
  phone: string;
  mobile: string;
  company_name: string;
  
  // Billing/Shipping Address
  billing_address: {
    attention: string;
    address: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  
  // Financial Information
  vat_reg_no: string;
  tax_reg_no: string;
  payment_terms: number;
  credit_limit: number;
  
  // Additional Fields
  website: string;
  industry?: string;
  notes?: string;
  language_code: string;
  facebook: string;
  twitter: string;
}

// Add props interface
interface NewCustomerProps {
  isModal?: boolean;
  onSuccess?: (newCustomer: any) => void;
  onCancel?: () => void;
}

export default function NewCustomer({ isModal = false, onSuccess, onCancel }: NewCustomerProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreatingInZoho, setIsCreatingInZoho] = useState(false);
  
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_name: '',
    email: '',
    phone: '',
    mobile: '',
    company_name: '',
    billing_address: {
      attention: '',
      address: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'GB'
    },
    vat_reg_no: '',
    tax_reg_no: '',
    payment_terms: 30,
    credit_limit: 5000,
    website: '',
    industry: '',
    notes: '',
    language_code: 'en',
    facebook: '',
    twitter: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if email already exists
      const emailQuery = query(
        collection(db, 'customer_data'),
        where('email', '==', formData.email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        setError('A customer with this email already exists.');
        setLoading(false);
        return;
      }

      // Prepare data for Firebase with all fields from customer_data collection
      const firebaseCustomerData = {
        // Core identifiers
        firebase_uid: '', // Will be set after Firebase Auth creation
        customer_id: '', // Will be set after Zoho creation
        
        // Customer information matching customer_data structure
        customer_name: formData.customer_name,
        company_name: formData.company_name,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.mobile,
        
        // Address information
        billing_address: {
          attention: formData.billing_address.attention,
          address: formData.billing_address.address,
          street2: formData.billing_address.street2,
          city: formData.billing_address.city,
          state: formData.billing_address.state,
          zip: formData.billing_address.zip,
          country: formData.billing_address.country
        },
        
        // Copy billing to shipping initially
        shipping_address: {
          attention: formData.billing_address.attention,
          address: formData.billing_address.address,
          street2: formData.billing_address.street2,
          city: formData.billing_address.city,
          state: formData.billing_address.state,
          zip: formData.billing_address.zip,
          country: formData.billing_address.country
        },
        
        // Financial information
        vat_reg_no: formData.vat_reg_no,
        tax_reg_no: formData.tax_reg_no,
        payment_terms: formData.payment_terms,
        credit_limit: formData.credit_limit,
        
        // Additional information
        website: formData.website,
        industry: formData.industry,
        notes: formData.notes,
        language_code: formData.language_code,
        facebook: formData.facebook,
        twitter: formData.twitter,
        
        // System fields
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: auth.currentUser?.uid || 'system',
        status: 'active',
        sync_status: 'pending'
      };

      // Save to Firestore first
      const docRef = await addDoc(collection(db, 'customer_data'), firebaseCustomerData);
      console.log('Customer created in Firebase with ID:', docRef.id);

      // Prepare customer object
      const customerForNavigation = {
        id: docRef.id,
        name: formData.customer_name,
        email: formData.email,
        company_name: formData.company_name
      };

      // If this is a modal, call onSuccess callback
      if (isModal && onSuccess) {
        onSuccess(customerForNavigation);
      } else {
        // Otherwise, navigate to brand selector
        localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customerForNavigation));
        navigate(`/select-brand/${docRef.id}`, {
          state: { 
            selectedCustomer: customerForNavigation,
            isNewCustomer: true
          }
        });
      }

      // Create customer in Zoho in the background
      setIsCreatingInZoho(true);
      createCustomerInZohoBackground(docRef.id, formData);
      
    } catch (error) {
      console.error('Error creating customer:', error);
      setError('Failed to create customer. Please try again.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isModal && onCancel) {
      onCancel();
    } else {
      navigate('/customers');
    }
  };

  const createCustomerInZohoBackground = async (firebaseDocId: string, customerData: CustomerFormData) => {
  try {
    // Parse first and last name
    const nameParts = customerData.customer_name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const webhookPayload = {
      // Firebase reference
      firebase_doc_id: firebaseDocId,
      
      // Core contact information
      contact_name: customerData.customer_name,
      first_name: firstName,
      last_name: lastName,
      company_name: customerData.company_name,
      email: customerData.email,
      phone: customerData.phone,
      mobile: customerData.mobile || customerData.phone,
      
      // Contact type and classification
      contact_type: 'customer',
      customer_sub_type: customerData.company_name ? 'business' : 'individual',
      
      // Financial settings
      credit_limit: customerData.credit_limit,
      payment_terms: customerData.payment_terms,
      currency_code: 'GBP',
      
      // Tax information
      vat_reg_no: customerData.vat_reg_no || '',
      tax_reg_no: customerData.tax_reg_no || '',
      
      // Addresses
      billing_address: {
        attention: customerData.billing_address.attention || customerData.customer_name,
        address: customerData.billing_address.address,
        street2: customerData.billing_address.street2,
        city: customerData.billing_address.city,
        state: customerData.billing_address.state,
        zip: customerData.billing_address.zip,
        country: customerData.billing_address.country
      },
      
      shipping_address: {
        attention: customerData.billing_address.attention || customerData.customer_name,
        address: customerData.billing_address.address,
        street2: customerData.billing_address.street2,
        city: customerData.billing_address.city,
        state: customerData.billing_address.state,
        zip: customerData.billing_address.zip,
        country: customerData.billing_address.country
      },
      
      // Additional fields
      website: customerData.website || '',
      language_code: customerData.language_code || 'en',
      facebook: customerData.facebook || '',
      twitter: customerData.twitter || '',
      industry: customerData.industry || '',
      notes: customerData.notes || '',
      
      // System fields
      created_at: new Date().toISOString(),
      source: 'web_app'
    };

    // Send to Make.com webhook
    const response = await fetch('https://hook.eu2.make.com/smvpudvrgsy9uhdxrviznlghs8wrivah', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log('Customer data sent to Make.com webhook successfully');
      
      // Update sync status to pending (Make.com will update it when done)
      await updateDoc(doc(db, 'customer_data', firebaseDocId), {
        sync_status: 'processing',
        webhook_sent_at: new Date().toISOString()
      });
    } else {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Error sending to Make.com webhook:', error);
    // Update sync status to failed
    await updateDoc(doc(db, 'customer_data', firebaseDocId), {
      sync_status: 'webhook_failed',
      sync_error: error.message || 'Failed to send to webhook'
    });
  }
};

  const handleInputChange = (field: string, value: string | number, isAddress = false) => {
    if (isAddress) {
      setFormData(prev => ({
        ...prev,
        billing_address: {
          ...prev.billing_address,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Wrapper div changes based on modal mode
  const containerClass = isModal ? 'new-customer-modal' : 'new-customer-module';

  return (
    <div className={containerClass}>
      {isModal && (
        <div className="modal-overlay" onClick={handleCancel} />
      )}
      
      <div className={isModal ? 'modal-content' : ''}>
        <div className="page-header">
          <h1 className="page-title">Add New Customer</h1>
          <p className="page-subtitle">Create a new customer account</p>
          {isModal && (
            <button 
              className="modal-close-btn" 
              onClick={handleCancel}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="customer-form-card">
          {error && (
            <div className="form-error-banner">
              {error}
            </div>
          )}

          {isCreatingInZoho && (
            <div className="form-info-banner">
              Creating customer in Zoho Inventory in the background...
            </div>
          )}

          {/* Basic Information */}
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="customer_name">
                  Full Name <span className="required-mark">*</span>
                </label>
                <input
                  id="customer_name"
                  type="text"
                  className="form-input"
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  required
                  placeholder="John Smith"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">
                  Email Address <span className="required-mark">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  placeholder="john.smith@company.com"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">
                  Phone Number <span className="required-mark">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  required
                  placeholder="+44 20 1234 5678"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="mobile">
                  Mobile Number
                </label>
                <input
                  id="mobile"
                  type="tel"
                  className="form-input"
                  value={formData.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  placeholder="+44 7700 900000"
                />
              </div>
              
              <div className="form-group form-grid-full">
                <label htmlFor="company_name">
                  Company Name
                </label>
                <input
                  id="company_name"
                  type="text"
                  className="form-input"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="ABC Company Ltd"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="form-section">
            <h2 className="section-title">Billing & Delivery Address</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="attention">
                  Attention To
                </label>
                <input
                  id="attention"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.attention}
                  onChange={(e) => handleInputChange('attention', e.target.value, true)}
                  placeholder="Accounts Department"
                />
              </div>
              
              <div className="form-group form-grid-full">
                <label htmlFor="address">
                  Address Line 1 <span className="required-mark">*</span>
                </label>
                <input
                  id="address"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.address}
                  onChange={(e) => handleInputChange('address', e.target.value, true)}
                  required
                  placeholder="123 Main Street"
                />
              </div>
              
              <div className="form-group form-grid-full">
                <label htmlFor="street2">
                  Address Line 2
                </label>
                <input
                  id="street2"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.street2}
                  onChange={(e) => handleInputChange('street2', e.target.value, true)}
                  placeholder="Suite 100"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="city">
                  City <span className="required-mark">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.city}
                  onChange={(e) => handleInputChange('city', e.target.value, true)}
                  required
                  placeholder="London"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="state">
                  County/State
                </label>
                <input
                  id="state"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.state}
                  onChange={(e) => handleInputChange('state', e.target.value, true)}
                  placeholder="Greater London"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="zip">
                  Postcode <span className="required-mark">*</span>
                </label>
                <input
                  id="zip"
                  type="text"
                  className="form-input"
                  value={formData.billing_address.zip}
                  onChange={(e) => handleInputChange('zip', e.target.value, true)}
                  required
                  placeholder="SW1A 1AA"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="country">
                  Country
                </label>
                <select
                  id="country"
                  className="form-select"
                  value={formData.billing_address.country}
                  onChange={(e) => handleInputChange('country', e.target.value, true)}
                >
                  <option value="GB">United Kingdom</option>
                  <option value="IE">Ireland</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="form-section">
            <h2 className="section-title">Financial Information</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="vat_reg_no">
                  VAT Number
                </label>
                <input
                  id="vat_reg_no"
                  type="text"
                  className="form-input"
                  value={formData.vat_reg_no}
                  onChange={(e) => handleInputChange('vat_reg_no', e.target.value)}
                  placeholder="GB123456789"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="tax_reg_no">
                  Company Registration Number
                </label>
                <input
                  id="tax_reg_no"
                  type="text"
                  className="form-input"
                  value={formData.tax_reg_no}
                  onChange={(e) => handleInputChange('tax_reg_no', e.target.value)}
                  placeholder="12345678"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="payment_terms">
                  Payment Terms
                </label>
                <select
                  id="payment_terms"
                  className="form-select"
                  value={formData.payment_terms}
                  onChange={(e) => handleInputChange('payment_terms', parseInt(e.target.value))}
                >
                  <option value={0}>Due on Receipt</option>
                  <option value={14}>Net 14</option>
                  <option value={30}>Net 30</option>
                  <option value={60}>Net 60</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="credit_limit">
                  Credit Limit (£)
                </label>
                <input
                  id="credit_limit"
                  type="number"
                  className="form-input"
                  value={formData.credit_limit}
                  onChange={(e) => handleInputChange('credit_limit', parseInt(e.target.value) || 0)}
                  placeholder="5000"
                  min="0"
                  step="100"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="form-section">
            <h2 className="section-title">Additional Information</h2>
            
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="website">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  className="form-input"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://www.example.com"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="language_code">
                  Preferred Language
                </label>
                <select
                  id="language_code"
                  className="form-select"
                  value={formData.language_code}
                  onChange={(e) => handleInputChange('language_code', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="facebook">
                  Facebook
                </label>
                <input
                  id="facebook"
                  type="text"
                  className="form-input"
                  value={formData.facebook}
                  onChange={(e) => handleInputChange('facebook', e.target.value)}
                  placeholder="facebook.com/company"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="twitter">
                  Twitter/X
                </label>
                <input
                  id="twitter"
                  type="text"
                  className="form-input"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                  placeholder="@company"
                />
              </div>
              
              <div className="form-group form-grid-full">
                <label htmlFor="industry">
                  Industry
                </label>
                <select
                  id="industry"
                  className="form-select"
                  value={formData.industry}
                  onChange={(e) => handleInputChange('industry', e.target.value)}
                >
                  <option value="">Select Industry</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="services">Services</option>
                  <option value="technology">Technology</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="form-group form-grid-full">
                <label htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional notes about this customer..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>{isModal ? 'Create Customer' : 'Create Customer & Continue'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}