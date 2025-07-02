// src/components/CataloguesLanding.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import './CataloguesLanding.css';

// for each brand we list the PNG‐covers (located in public/catalogues/{brand}/{file})
const CATALOGUES: Record<string, string[]> = {
  blomus: ['blomus.png', 'furniture.png'],
  rader: ['everyday.png','easter.png','trevoly.png'],
  myflame: ['myflame.png'],
  elvang: ['elvang.png'],
  remember: ['remember.png'],
  relaxound: ['relaxound.png'],
};

export default function CataloguesLanding() {
  return (
    <div className="catalogues-landing">
      <h2 className="catalogues-landing__title">Catalogues</h2>
      <div className="catalogues-landing__grid">
        {Object.entries(CATALOGUES).map(([brand, covers]) => (
          <div key={brand} className="catalogues-landing__card">
            {/* Brand logo */}
            <div className="catalogues-landing__brand">
              <img
                className="catalogues-landing__brand-logo"
                src={`/catalogues/${brand}/logo.png`}
                alt={`${brand} logo`}
              />
            </div>
            {/* Covers grid */}
            <div className="catalogues-landing__covers">
              {covers.map((file) => {
                const pdfFile = file.replace(/\.png$/, '.pdf');
                return (
<Link
  key={file}
  to={`/catalogues/${brand}/${file.replace(/\.png$/, '.pdf')}`}
  className="catalogues-landing__cover-link"
>
  <img
    className="catalogues-landing__cover-thumb"
    src={`/catalogues/${brand}/${file}`}
    alt={`${brand} catalogue cover`}
  />
</Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
