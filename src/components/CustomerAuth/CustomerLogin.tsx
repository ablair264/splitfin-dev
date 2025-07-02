// src/components/CustomerAuth/CustomerLogin.tsx
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, query, collection, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import loaderAnimation from '../../loader.json';
import './CustomerLogin.css';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Only allow sign in, not sign up
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Find the customer data using various possible fields
      let customerDoc = null;
      const queries = [
        query(collection(db, 'customer_data'), where('firebaseUID', '==', userCredential.user.uid)),
        query(collection(db, 'customer_data'), where('email', '==', email)),
      ];
      
      for (const q of queries) {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          customerDoc = snapshot.docs[0];
          break;
        }
      }
      
      if (customerDoc && customerDoc.exists()) {
        // Update last login and online status
        await updateDoc(customerDoc.ref, {
          lastLogin: new Date().toISOString(),
          isOnline: true,
          lastSeen: new Date().toISOString()
        });
        
        // Create or update user record for messaging system
        // This ensures customers can be messaged by staff
        const userRef = doc(db, 'users', userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          // Create user record if it doesn't exist
          const customerData = customerDoc.data();
          await addDoc(collection(db, 'users'), {
            uid: userCredential.user.uid,
            email: email,
            name: customerData.contact_name || customerData.contactName || customerData.company_name || 'Customer',
            role: 'customer',
            companyName: customerData.company_name || customerData.companyName || '',
            isOnline: true,
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
        } else {
          // Update existing user record
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: new Date().toISOString()
          });
        }
        
        navigate('/customer/dashboard');
      } else {
        throw new Error('Customer account not found. Please contact support.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found. Please apply for access first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-auth-container">
      <div className="auth-form-container">
        <div className="auth-form">
          <div className="auth-hero">
            <img src="/logos/splitfin.png" alt="Splitfin" className="auth-logo" />
            <h1>Welcome to Splitfin</h1>
            <p>Your premium brands marketplace</p>
          </div>

          <h2>Customer Sign In</h2>
          
          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            
            <button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="button-loader">
                    <Lottie 
                      animationData={loaderAnimation}
                      loop={true}
                      autoplay={true}
                      style={{ 
                        width: '24px', 
                        height: '24px',
                        filter: 'brightness(0) invert(1)'
                      }}
                    />
                  </div>
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
         <div className="auth-footer">
          <p className="help-text">
            Don't have an account? <Link to="/customer/signup">Apply for Access</Link>
          </p>
          
            <p className="help-text">
              Forgot your password? Contact your sales representative for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}