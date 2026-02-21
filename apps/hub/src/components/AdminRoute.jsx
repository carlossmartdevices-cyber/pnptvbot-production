import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    window.location.replace('/');
    return null;
  }

  if (!['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
