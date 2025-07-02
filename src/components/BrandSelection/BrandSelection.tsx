// src/components/BrandSelection/BrandSelection.tsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './BrandSelection.css';
import Lottie from 'lottie-react';
import loaderAnimation from '../../loader.json';

interface Brand {
  id: string;
  name: string;
  logoFileName: string;
  backgroundImage: string;
  catalogues: string[];
}

const BRANDS: Brand[] = [
  { 
    id: 'blomus', 
    name: 'Blomus', 
    logoFileName: 'blomus.png',
    backgroundImage: '../..public/images/blomus.jpg',
    catalogues: ['blomus.pdf', 'furniture.pdf']
  },
  { 
    id: 'elvang', 
    name: 'Elvang', 
    logoFileName: 'elvang.png',
    backgroundImage: '../..public/images/elvang.jpg',
    catalogues: ['elvang.pdf']
  },
  { 
    id: 'myflamelifestyle', 
    name: 'My Flame Lifestyle', 
    logoFileName: 'myflame.png',
    backgroundImage: '../..public/images/myflame.jpg',
    catalogues: ['myflame.pdf']
  },
  { 
    id: 'rader', 
    name: 'Räder', 
    logoFileName: 'rader.png',
    backgroundImage: '../..public/images/rader.jpg',
    catalogues: ['everyday.pdf', 'easter.pdf', 'trevoly.pdf']
  },
  { 
    id: 'relaxound', 
    name: 'Relaxound', 
    logoFileName: 'relaxound.png',
    backgroundImage: '../..public/images/relaxound.jpg',
    catalogues: ['relaxound.pdf']
  },
  { 
    id: 'remember', 
    name: 'Remember', 
    logoFileName: 'remember.png',
    backgroundImage: '../..public/images/remember.jpg',
    catalogues: ['remember.pdf']
  },
];

export default function BrandSelection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for smooth animation
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleBrowseProducts = (brand: Brand) => {
    navigate(`/customer/brand/${brand.id}`);
  };

  const handleViewCatalogue = (brand: Brand, catalogue: string) => {
    navigate(`/customer/catalogue/${brand.id}/${catalogue}`);
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Lottie 
          animationData={loaderAnimation}
          loop={true}
          autoplay={true}
          style={{ width: 100, height: 100 }}
        />
      </div>
    );
  }

  return (
    <div className="brand-selection-page">
      <div className="page-header">
        <h1>Select a Brand</h1>
        <p className="page-subtitle">Discover our curated collection of premium lifestyle brands</p>
      </div>

      <div className="brands-grid">
        {BRANDS.map((brand, index) => (
          <div 
            key={brand.id} 
            className="brand-card"
            style={{ '--animation-order': index } as React.CSSProperties}
          >
            <img
              src={brand.backgroundImage}
              alt={brand.name}
              className="brand-card-background"
              loading="lazy"
            />
            
            <div className="brand-card-content">
              <h3 className="brand-card-title">{brand.name}</h3>
              
              <div className="brand-card-buttons">
                <button
                  className="brand-card-btn brand-card-btn-primary"
                  onClick={() => handleBrowseProducts(brand)}
                >
                  Browse Products
                </button>
                
                <div className="catalogue-dropdown">
                  <button className="brand-card-btn brand-card-btn-secondary">
                    View Catalogues
                  </button>
                  <div className="catalogue-dropdown-content">
                    {brand.catalogues.map(catalogue => (
                      <button
                        key={catalogue}
                        onClick={() => handleViewCatalogue(brand, catalogue)}
                        className="catalogue-item"
                      >
                        {catalogue.replace('.pdf', '').charAt(0).toUpperCase() + 
                         catalogue.replace('.pdf', '').slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}