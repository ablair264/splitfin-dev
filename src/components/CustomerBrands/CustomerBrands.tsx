// src/components/CustomerBrands/CustomerBrands.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './CustomerBrands.css';

const brands = [
  {
    id: 'blomus',
    name: 'Blomus',
    description: 'Modern design for contemporary living',
    image: '/images/brands/blomus-hero.jpg'
  },
  {
    id: 'elvang',
    name: 'Elvang',
    description: 'Scandinavian textiles and home accessories',
    image: '/images/brands/elvang-hero.jpg'
  },
  {
    id: 'myflamelifestyle',
    name: 'My Flame Lifestyle',
    description: 'Scented candles with personality',
    image: '/images/brands/myflame-hero.jpg'
  },
  {
    id: 'rader',
    name: 'Räder',
    description: 'Poetry for living spaces',
    image: '/images/brands/rader-hero.jpg'
  },
  {
    id: 'remember',
    name: 'Remember',
    description: 'Colorful design for everyday life',
    image: '/images/brands/remember-hero.jpg'
  },
  {
    id: 'relaxound',
    name: 'Relaxound',
    description: 'Nature-inspired sound experiences',
    image: '/images/brands/relaxound-hero.jpg'
  }
];

export default function CustomerBrands() {
  return (
    <div className="customer-brands">
      <h1>Our Brands</h1>
      <p className="brands-intro">Discover our carefully curated collection of lifestyle brands</p>
      
      <div className="brands-showcase">
        {brands.map(brand => (
          <Link to={`/customer/brand/${brand.id}`} key={brand.id} className="brand-showcase-card">
            <div className="brand-image">
              <img src={brand.image} alt={brand.name} />
              <div className="brand-overlay">
                <span className="shop-now">Shop Now</span>
              </div>
            </div>
            <div className="brand-details">
              <h2>{brand.name}</h2>
              <p>{brand.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}