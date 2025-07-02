// src/hooks/useCart.ts
import { useState, useEffect } from 'react';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  brand?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  item_id?: string;
}

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [zohoCustomerId, setZohoCustomerId] = useState<string | null>(null);

  // Get Zoho customer ID on mount
  useEffect(() => {
    getZohoCustomerId();
  }, []);

  const getZohoCustomerId = async () => {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const customerQuery = query(
        collection(db, 'customer_data'),
        where('firebase_uid', '==', user.uid)
      );
      const customerSnapshot = await getDocs(customerQuery);
      
      if (!customerSnapshot.empty) {
        const customerData = customerSnapshot.docs[0].data();
        const customerId = customerData.zoho_data?.customer_id || customerData.customer_id;
        setZohoCustomerId(customerId);
        return customerId;
      }
    } catch (error) {
      console.error('Error getting Zoho customer ID:', error);
    }
    return null;
  };

  // Load cart from localStorage on mount and when storage changes
  useEffect(() => {
    loadCart();
    // Listen for cart updates from other components
    const handleStorageChange = () => {
      loadCart();
    };
    window.addEventListener('orderUpdated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('orderUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const loadCart = () => {
    const savedOrder = localStorage.getItem('customerOrder');
    if (savedOrder) {
      try {
        const orderData = JSON.parse(savedOrder);
        // Transform the data structure from CustomerProducts format
        const transformedItems = orderData.map((item: any) => ({
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          brand: item.product.brand,
          price: item.product.price,
          quantity: item.quantity,
          imageUrl: item.product.imageUrl,
          item_id: item.product.item_id
        }));
        setItems(transformedItems);
      } catch (error) {
        console.error('Error loading cart:', error);
        setItems([]);
      }
    } else {
      setItems([]);
    }
  };

  const saveCart = (newItems: CartItem[]) => {
    // Transform back to CustomerProducts format for consistency
    const orderFormat = newItems.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        brand: item.brand,
        price: item.price,
        imageUrl: item.imageUrl,
        item_id: item.item_id
      },
      quantity: item.quantity
    }));
    
    localStorage.setItem('customerOrder', JSON.stringify(orderFormat));
    setItems(newItems);
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('orderUpdated'));
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(id);
      return;
    }
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, quantity: newQuantity } : item
    );
    saveCart(updatedItems);
  };

  const removeFromCart = (id: string) => {
    const updatedItems = items.filter(item => item.id !== id);
    saveCart(updatedItems);
  };

  const clearCart = async () => {
    localStorage.removeItem('customerOrder');
    setItems([]);
    
    // Clear Firebase cart using Zoho customer_id
    const customerId = zohoCustomerId || await getZohoCustomerId();
    if (customerId) {
      try {
        await setDoc(doc(db, 'carts', customerId), {
          items: [],
          updatedAt: new Date().toISOString(),
          customerId: customerId,
          firebaseUid: auth.currentUser?.uid
        });
      } catch (error) {
        console.error('Error clearing Firebase cart:', error);
      }
    }
    
    window.dispatchEvent(new Event('orderUpdated'));
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  return {
    items,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems
  };
};