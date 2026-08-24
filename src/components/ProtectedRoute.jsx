import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Shows loading spinner while auth is initializing
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo">
        <div className="loading-spinner"></div>
        <p>VK IT Solutions</p>
      </div>
    </div>
  );
}

/**
 * Requires authentication. Redirects to /login if not authenticated.
 */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

/**
 * Requires employee role. Redirects non-employees.
 */
export function RequireEmployee({ children }) {
  const { isAuthenticated, isEmployee, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!isEmployee) {
    // Admin trying to access employee routes → redirect to admin
    if (profile?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * Requires admin role. Redirects non-admins.
 */
export function RequireAdmin({ children }) {
  const { isAuthenticated, isAdmin, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!isAdmin) {
    // Employee trying to access admin → redirect to employee dashboard
    if (profile?.role === 'employee') {
      return <Navigate to="/employee" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * Redirects authenticated users away from login page
 */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated, isAdmin, isEmployee, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    if (isAdmin) return <Navigate to="/admin" replace />;
    if (isEmployee) return <Navigate to="/employee" replace />;
  }
  return children;
}
