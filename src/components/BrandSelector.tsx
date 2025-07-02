// src/components/BrandSelector.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import './BrandSelector.css';
import { ProgressBar } from './ProgressBar';

const LOADER_SRC = 'https://lottie.host/83bc32e5-8bd1-468d-8dc6-8aae7c529ade/eEUoZnLTlp.lottie';

interface Brand {
  id: string;
  name: string;
  logoFileName: string;
  backgroundImage: string;
  description?: string;
  productCount?: number;
  lastOrdered?: string;
}

interface Customer {
  id: string;
  name?: string;
  Primary_First_Name?: string;
  Primary_Last_Name?: string;
  Primary_Email?: string;
  email?: string;
  customer_name?: string;
  phone?: string;
  billing_address?: string[];
}

const HARDCODED_BRANDS: Brand[] = [
  { 
    id: 'blomus', 
    name: 'Blomus', 
    logoFileName: '/logos/blomus.png',
    backgroundImage: '/images/blomus.jpg',
    description: 'Modern living essentials with minimalist German design',
    productCount: 156,
    lastOrdered: '2 days ago'
  },
  { 
    id: 'elvang', 
    name: 'Elvang', 
    logoFileName: '/logos/elvang.png',
    backgroundImage: '/images/elvang.jpg',
    description: 'Danish design heritage meets contemporary comfort',
    productCount: 89,
    lastOrdered: '1 week ago'
  },
  { 
    id: 'myflamelifestyle', 
    name: 'My Flame Lifestyle', 
    logoFileName: '/logos/myflame.png',
    backgroundImage: '/images/myflame.jpg',
    description: 'Scented candles and home fragrances for every mood',
    productCount: 234,
    lastOrdered: 'Yesterday'
  },
  { 
    id: 'rader', 
    name: 'Räder', 
    logoFileName: '/logos/rader.png',
    backgroundImage: '/images/rader.jpg',
    description: 'Poetry in porcelain - German craftsmanship since 1968',
    productCount: 178,
    lastOrdered: '3 days ago'
  },
  { 
    id: 'relaxound', 
    name: 'Relaxound', 
    logoFileName: '/logos/relaxound.png',
    backgroundImage: '/images/relaxound.jpg',
    description: 'Nature-inspired acoustic experiences for modern spaces',
    productCount: 45,
    lastOrdered: '2 weeks ago'
  },
  { 
    id: 'remember', 
    name: 'Remember', 
    logoFileName: '/logos/remember.png',
    backgroundImage: '/images/remember.jpg',
    description: 'Timeless designs that create lasting memories',
    productCount: 203,
    lastOrdered: '5 days ago'
  },
];

const PROGRESS_STEPS = [
  { id: 1, label: 'Select Brand', active: true },
  { id: 2, label: 'Browse Items', active: false },
  { id: 3, label: 'Review Order', active: false },
  { id: 4, label: 'Place Order', active: false },
  { id: 5, label: 'Order Confirmed', active: false },
];

const getCompanyLogo = (email: string) => {
  if (!email) return null;
  const domain = email.split('@')[1];
  if (!domain) return null;
  
  const excludedDomains = [
    'gmail.com',
    'yahoo.com',
    'yahoo.co.uk',
    'hotmail.com',
    'hotmail.co.uk',
    'outlook.com',
    'outlook.co.uk',
    'live.com',
    'live.co.uk',
    'msn.com',
    'aol.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'protonmail.com',
    'proton.me',
    'yandex.com',
    'mail.com',
    'gmx.com',
    'gmx.co.uk',
    'zoho.com',
    'fastmail.com',
    'tutanota.com',
    'qq.com',
    '163.com',
    '126.com'
  ];
  
  if (excludedDomains.includes(domain.toLowerCase())) {
    return null;
  }
  
  return `https://logo.clearbit.com/${domain}`;
};

export default function BrandSelector() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  useEffect(() => {
    async function initCustomer() {
      let customer: Customer | null = null;

      if (location.state?.selectedCustomer) {
        customer = location.state.selectedCustomer;
        localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customer));
      } else {
        const stored = localStorage.getItem('SELECTED_CUSTOMER');
        if (stored) {
          try {
            customer = JSON.parse(stored);
          } catch {
            console.warn('Failed to parse stored customer');
          }
        }
      }

      if (customer) {
        setSelectedCustomer(customer);

        if (customerId) {
          try {
            const customerDoc = await getDoc(doc(db, 'customer_data', customerId));
            if (customerDoc.exists()) {
              setCustomerDetails(customerDoc.data() as Customer);
            }
          } catch (error) {
            console.error('Error fetching customer details:', error);
          }
        }

        try {
          const res = await fetch('https://splitfin-zoho-api.onrender.com/api/sync-inventory-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: customer.Primary_Email || customer.email,
              docId: customer.id
            })
          });

          const result = await res.json();
          if (!res.ok || !result.success) {
            console.warn('Zoho sync API call failed:', result.error || 'Unknown error');
          } else {
            console.log(`✅ Synced Inventory ID for ${customer.Primary_Email || customer.email}`);
          }
        } catch (err) {
          console.error('❌ Error syncing Inventory contact:', err);
        }
      }

      setLoading(false);
    }

    initCustomer();
  }, [location.state, customerId]);
  
  const normalize = (name: string) => 
    name.toLowerCase().replace(/\s+/g, '');

  const handleStartOrder = (brand: Brand) => {
    if (!selectedCustomer) {
      alert('No customer selected. Please go back and select a customer.');
      return;
    }

    const normalizedBrand = normalize(brand.name);
    navigate(`/products/${customerId}/${normalizedBrand}`, {
      state: { 
        selectedCustomer,
        fromCustomerList: true
      }
    });
  };

  const handleViewCatalogue = (brand: Brand) => {
    const normalizedBrand = normalize(brand.name);
    navigate(`/catalogue/${normalizedBrand}`, {
      state: { selectedCustomer }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, brand: Brand) => {
    if (e.key === 'Enter') {
      handleStartOrder(brand);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <DotLottieReact
          src={LOADER_SRC}
          loop
          autoplay
          className="loader-large"
        />
      </div>
    );
  }

  const customerData = customerDetails || selectedCustomer;
  const customerName = customerData?.customer_name || customerData?.name || 
    `${customerData?.Primary_First_Name || ''} ${customerData?.Primary_Last_Name || ''}`.trim();
  const customerEmail = customerData?.Primary_Email || customerData?.email;
  const companyLogo = customerEmail ? getCompanyLogo(customerEmail) : null;

  return (
    <div className="brand-selector-page-list">
      {/* Header */}
      <header className="list-header">
        <div className="header-top">
          <button 
            onClick={() => navigate('/customers')}
            className="back-btn"
            aria-label="Back"
          >
            ← Back
          </button>
          
          <div className="header-center">
            <h1>Select Brand</h1>
          </div>

          <div className="header-spacer"></div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="progress-bar-container">
	  <ProgressBar currentStep={1} theme="dark" />
</div>
      {/* Customer Information Card */}
      <div className="customer-info-section">
        <div className="customer-info-card">
          <div className="customer-card-header">
            <h2>Customer Information</h2>
          </div>
          <div className="customer-card-content">
            {companyLogo && (
              <div className="company-logo-wrapper">
                <img 
                  src={companyLogo} 
                  alt="Company logo" 
                  className="company-logo"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className={`customer-details ${companyLogo ? 'with-logo' : ''}`}>
              <div className="customer-field">
                <span className="field-label">Name</span>
                <span className="field-value">{customerName || 'N/A'}</span>
              </div>
              <div className="customer-field">
                <span className="field-label">Email</span>
                <span className="field-value">{customerEmail || 'N/A'}</span>
              </div>
              <div className="customer-field">
                <span className="field-label">Phone</span>
                <span className="field-value">{customerData?.phone || 'N/A'}</span>
              </div>
              {customerData?.billing_address && customerData.billing_address.length > 0 && (
                <div className="customer-field address-field">
                  <span className="field-label">Billing Address</span>
                  <div className="field-value address-value">
                    {customerData.billing_address.map((line, index) => (
                      <span key={index}>{line}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Brand List */}
      <div className="brands-list">
        {HARDCODED_BRANDS.map((brand) => (
          <div 
            key={brand.id}
            className={`brand-row ${expandedBrand === brand.id ? 'expanded' : ''}`}
            onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
            onKeyPress={(e) => handleKeyPress(e, brand)}
            tabIndex={0}
            role="button"
            aria-expanded={expandedBrand === brand.id}
          >
            <div className="brand-row-main">
              <div className="brand-row-left">
                <img 
                  src={brand.logoFileName} 
                  alt=""
                  className="brand-thumb"
                />
                <div className="brand-info">
                  <h3 className="brand-name">{brand.name}</h3>
                  <p className="brand-meta">
                    {brand.productCount} products • Last ordered {brand.lastOrdered}
                  </p>
                </div>
              </div>

              <div className="brand-row-actions">
                <button
                  className="quick-action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartOrder(brand);
                  }}
                  aria-label="Start order"
                >
                  <span className="btn-text">Order</span>
                  <span className="btn-icon">→</span>
                </button>
                <button
                  className="quick-action-btn secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewCatalogue(brand);
                  }}
                  aria-label="View catalogue"
                >
                  <span className="btn-text">Catalogue</span>
                  <span className="btn-icon">↗</span>
                </button>
                <button
                  className="expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedBrand(expandedBrand === brand.id ? null : brand.id);
                  }}
                  aria-label={expandedBrand === brand.id ? 'Collapse' : 'Expand'}
                >
                  <svg 
                    className={`chevron ${expandedBrand === brand.id ? 'rotated' : ''}`} 
                    width="20" 
                    height="20" 
                    viewBox="0 0 20 20" 
                    fill="none"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {expandedBrand === brand.id && (
              <div className="brand-row-expanded">
                <div className="expanded-content">
                  <div className="expanded-image">
                    <img 
                      src={brand.backgroundImage} 
                      alt={brand.name}
                      className="brand-preview"
                    />
                  </div>
                  <div className="expanded-details">
                    <p className="brand-description">{brand.description}</p>
                    <div className="expanded-actions">
                      <button
                        className="expanded-btn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartOrder(brand);
                        }}
                      >
                        Start New Order
                      </button>
                      <button
                        className="expanded-btn secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewCatalogue(brand);
                        }}
                      >
                        Browse Full Catalogue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}