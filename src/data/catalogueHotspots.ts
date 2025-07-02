export interface Hotspot {
  page:      number;   // PDF page number (1-based)
  x:         number;   // left offset in PDF coordinate units
  y:         number;   // top offset in PDF coordinate units
  width:     number;
  height:    number;
  sku:       string;
}

// Example: you’ll fill these in by measuring your PDF
export const catalogueHotspots: Hotspot[] = [
  { page: 1, x: 100, y: 200, width: 150, height: 80, sku: '9479' },
  { page: 1, x: 300, y: 500, width: 150, height: 80, sku: '17468' },
  // …and so on for each product region
];