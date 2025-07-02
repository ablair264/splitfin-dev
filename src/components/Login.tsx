// src/components/Login.tsx
import React, { useState } from 'react'
import { auth, db } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore' // Fixed imports
import { useNavigate, Link } from 'react-router-dom'
import './login.css'
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const nav = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // 1) Firebase Auth login
      const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password)

      // 2) Use Auth UID directly to get user record
      const userRef = doc(db, 'users', fbUser.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        setError("No user record found in Firestore for this account.")
        setIsLoading(false)
        return
      }

      const userData = userSnap.data()

      // 3) Store any needed metadata
      if (userData?.role === 'salesAgent' && userData?.agentID) {
        localStorage.setItem('agentID', userData.agentID)
      }

      // 4) Update online status and last login
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString(),
        isOnline: true,
        lastSeen: new Date().toISOString()
      })

      // 5) Redirect - loading state will be cleared when component unmounts
      nav('/dashboard')

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Login failed. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <img 
                src="/logos/splitfinrow.png" 
                alt="Splitfin" 
                className="logo-image"
              />
            </div>
            <p className="login-subtitle">Access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <div className="error-icon">⚠️</div>
                <span>{error}</span>
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email Address</label>
              <div className="input-container">
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-container">
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="form-input"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? (
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
                <>
                  <span>Sign In</span>
                  <svg className="button-arrow" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="help-text">
              Need help? Contact your administrator for assistance.
            </p>
            
            {/* Add Customer Portal Link */}
            <div className="customer-portal-section">
              <p className="divider-text">Are you a customer?</p>
              <Link to="/customer/login" className="customer-portal-link">
                Go to Customer Portal →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}