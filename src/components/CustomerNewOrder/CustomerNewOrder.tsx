import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import './CustomerNewOrder.css';

interface Brand {
  id: string;
  name: string;
  description: string;
  productCount: number;
  lastOrdered: string;
}

const BRANDS: Brand[] = [
  { 
    id: 'blomus', 
    name: 'Blomus',
    description: 'Modern living essentials with minimalist German design',
    productCount: 156,
    lastOrdered: '2 days ago'
  },
  { 
    id: 'elvang', 
    name: 'Elvang',
    description: 'Danish design heritage meets contemporary comfort',
    productCount: 89,
    lastOrdered: '1 week ago'
  },
  { 
    id: 'myflame', 
    name: 'My Flame',
    description: 'Scented candles and home fragrances for every mood',
    productCount: 234,
    lastOrdered: 'Yesterday'
  },
  { 
    id: 'rader', 
    name: 'Räder',
    description: 'Poetry in porcelain - German craftsmanship since 1968',
    productCount: 178,
    lastOrdered: '3 days ago'
  },
  { 
    id: 'relaxound', 
    name: 'Relaxound',
    description: 'Nature-inspired acoustic experiences for modern spaces',
    productCount: 45,
    lastOrdered: '2 weeks ago'
  },
  { 
    id: 'remember', 
    name: 'Remember',
    description: 'Timeless designs that create lasting memories',
    productCount: 203,
    lastOrdered: '5 days ago'
  }
];

export default function CustomerNewOrder() {
  const navigate = useNavigate();
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  
  return (
    <div className="cst-customer-new-order-page">
      <ProgressBar currentStep={1} />
      
      <div className="cst-order-header">
        <h1>Start New Order</h1>
        <p className="cst-order-subtitle">Select a brand to begin browsing products</p>
      </div>
      
      <div className="cst-brands-list">
        {BRANDS.map((brand) => (
          <div 
            key={brand.id}
            className={`brand-row ${expandedBrand === brand.id ? 'expanded' : ''}`}
            onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
          >
            <div className="cst-brand-row-main">
              <div className="cst-brand-row-left">
                <img 
                  src={`/logos/${brand.id}.png`} 
                  alt={brand.name}
                  className="cst-brand-thumb"
                />
                <div className="cst-brand-info">
                  <h3 className="cst-brand-name">{brand.name}</h3>
                  <p className="cst-brand-meta">
                    {brand.productCount} products • Last ordered {brand.lastOrdered}
                  </p>
                </div>
              </div>

              <div className="cst-brand-row-actions">
                <button
                  className="cst-quick-action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customer/brand/${brand.id}`);
                  }}
                >
                  <span className="cst-btn-text">Browse</span>
                  <span className="cst-btn-icon">→</span>
                </button>
                <button
                  className="cst-expand-btn"
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
              <div className="cst-brand-row-expanded">
                <div className="cst-expanded-content">
                  <div className="cst-expanded-image">
                    <img 
                      src={`/images/${brand.id}.jpg`} 
                      alt={brand.name}
                      className="brand-preview"
                    />
                  </div>
                  <div className="cst-xpanded-details">
                    <p className="cst-brand-description">{brand.description}</p>
                    <div className="cst-expanded-actions">
                      <button
                        className="cst-expanded-btn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customer/brand/${brand.id}`);
                        }}
                      >
                        Browse Products
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