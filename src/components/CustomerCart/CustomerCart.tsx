// src/components/CustomerCart/CustomerCart.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../hooks/useCart';
import { ProgressBar } from '../ProgressBar/ProgressBar';
import '../CustomerCart/CustomerCart.css';


export default function CustomerCart() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, getTotalPrice } = useCart();

// In CustomerCart.tsx, update the handleCheckout function:
const handleCheckout = () => {
  navigate('/customer/checkout');
};

  if (items.length === 0) {
    return (
      <div className="empty-cart">
        <h2>Your cart is empty</h2>
        <p>Browse our brands to add products to your cart</p>
        <button onClick={() => navigate('/customer/brands')} className="continue-shopping">
          Continue Shopping
        </button>
      </div>
    );
  }

   return (
    <div className="customer-cart">
      <ProgressBar currentStep={3} />
      <h1>Shopping Cart</h1>
      
      <div className="cart-items">
        {items.map(item => (
          <div key={item.id} className="cart-item">
            <div className="item-image">
              <img src={item.imageUrl || '/placeholder.png'} alt={item.name} />
            </div>
            
            <div className="item-details">
              <h3>{item.name}</h3>
              <p className="item-sku">SKU: {item.sku}</p>
              {item.brand && <p className="item-brand">{item.brand}</p>}
            </div>
            
            <div className="item-quantity">
              <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
            </div>
            
            <div className="item-price">
              £{(item.price * item.quantity).toFixed(2)}
            </div>
            
            <button className="remove-item" onClick={() => removeFromCart(item.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
      
      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>£{getTotalPrice().toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>VAT (20%)</span>
          <span>£{(getTotalPrice() * 0.2).toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>£{(getTotalPrice() * 1.2).toFixed(2)}</span>
        </div>
        
        <div className="cart-actions">
          <button onClick={clearCart} className="clear-cart">Clear Cart</button>
          <button onClick={handleCheckout} className="checkout-btn">Proceed to Checkout</button>
        </div>
      </div>
    </div>
  );
}