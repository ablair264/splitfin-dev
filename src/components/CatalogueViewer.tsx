// src/components/CatalogueViewer.tsx
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { catalogueHotspots, Hotspot } from '../data/catalogueHotspots';
import './CatalogueViewer.css';

// tell pdfjs where to find its worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

export default function CatalogueViewer() {
  const { brandName, pdfFilename } = useParams<{
    brandName: string;
    pdfFilename: string;
  }>();

  const pdfUrl = `/catalogues/${brandName}/${pdfFilename}`;

  const [numPages, setNumPages] = useState<number>(0);
  function onDocumentLoad({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const addToCart = (sku: string) => {
    // your existing add-to-order logic here
    console.log('Adding to cart:', sku);
  };

  return (
    <div className="catalogue-viewer">
      <h2>{brandName} Catalogue</h2>

      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoad}
        loading="Loading catalogue…"
      >
        {Array.from({ length: numPages }, (_, i) => {
          const pageNumber = i + 1;
          return (
            <div key={pageNumber} className="catalogue-viewer__page">
              <Page
                pageNumber={pageNumber}
                width={800}            // or whatever max width you prefer
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
              {/* Overlay hotspots for this page */}
              {catalogueHotspots
                .filter(h => h.page === pageNumber)
                .map((h: Hotspot) => (
                  <div
                    key={h.sku}
                    className="catalogue-hotspot"
                    style={{
                      left:   `${h.x}px`,
                      top:    `${h.y}px`,
                      width:  `${h.width}px`,
                      height: `${h.height}px`,
                    }}
                    onClick={() => addToCart(h.sku)}
                    title={`Add SKU ${h.sku}`}
                  />
                ))}
            </div>
          );
        })}
      </Document>
    </div>
  );
}