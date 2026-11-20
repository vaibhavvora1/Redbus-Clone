// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute — renders children only if the user is authenticated (and has required role if specified).
 * If unauthenticated, redirects to login while preserving the attempted URL in state for post-login return.
 *
 * @param {string|null} role     - Optional role restriction ("ADMIN")
 * @param {string} redirect      - Where to redirect if unauthenticated
 */
export default function ProtectedRoute({ children, role = null, redirect = "/login" }) {
  const { currentUser, authLoading } = useAuth();
  const location = useLocation();

  // Wait for GET /api/auth/me to resolve before making redirection decisions
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!currentUser) {
    const returnTarget = `${location.pathname}${location.search}`;
    return <Navigate to={redirect} state={{ from: returnTarget }} replace />;
  }

  if (role && String(currentUser.role || "").toUpperCase() !== String(role).toUpperCase()) {
    // Insufficient permissions → redirect to home
    return <Navigate to="/" replace />;
  }

  return children;
}
