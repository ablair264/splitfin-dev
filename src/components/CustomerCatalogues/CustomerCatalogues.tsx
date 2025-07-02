// src/components/CustomerCatalogues/CustomerCatalogues.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBook, FaDownload } from 'react-icons/fa';
import './CustomerCatalogues.css';

const catalogues = [
  { brand: 'Blomus', year: '2025', pdf: '/catalogues/blomus/blomus.pdf' },
  { brand: 'Elvang', year: '2025', pdf: '/catalogues/elvang/elvang.pdf' },
  { brand: 'My Flame Lifestyle', year: '2025', pdf: '/catalogues/myflame/myflame.pdf' },
  { brand: 'Räder', year: '2025', pdf: '/catalogues/rader/rader.pdf' },
  { brand: 'Relaxound', year: '2025', pdf: '/catalogues/relaxound/relaxound.pdf' },
  { brand: 'Remember', year: '2025', pdf: '/catalogues/remember/remember.pdf' }
];

export default function CustomerCatalogues() {
  const navigate = useNavigate();

  return (
    <div className="customer-catalogues">
      <div className="catalogues-header">
        <h1>Brand Catalogues</h1>
        <button 
          className="request-physical-btn"
          onClick={() => navigate('/customer/catalogues/request')}
        >
          Request Physical Catalogues
        </button>
      </div>

      <div className="catalogues-grid">
        {catalogues.map(catalogue => (
          <div key={catalogue.brand} className="catalogue-card">
            <div className="catalogue-cover">
              <FaBook className="book-icon" />
              <img src={`/logos/${catalogue.brand.toLowerCase().replace(' ', '')}.png`} alt={catalogue.brand} />
            </div>
            <div className="catalogue-info">
              <h3>{catalogue.brand}</h3>
              <p>{catalogue.year} Catalogue</p>
            </div>
            <div className="catalogue-actions">
              <button className="view-btn">View Online</button>
              <button className="download-btn">
                <FaDownload /> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}