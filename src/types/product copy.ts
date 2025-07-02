// For your AllProducts component
export interface ProductItem {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  retailPrice: number;
  price: number; // Add this required field
  brand: string;
  brand_normalized: string;
}

// For your ProductCard component  
export interface ProductCardItem {
  id: string;
  name: string;
  sku: string;
  stockLevel: number;
  retailPrice: number;
  brand: string;
  // Add any other fields your ProductCard needs
}

// You can alias one of these as Product if needed
export type Product = ProductItem;