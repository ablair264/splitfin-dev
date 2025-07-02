import React from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

interface CustomerProtectedRouteProps {
  children: React.ReactNode;
}

export default function CustomerProtectedRoute({ children }: CustomerProtectedRouteProps) {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/customer/login" replace />;
  }

  return <>{children}</>;
}