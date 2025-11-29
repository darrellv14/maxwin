import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { isAuthenticated, isAdmin, verifyToken, getUser, clearAuth } from "../services/authService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const verify = async () => {
      // Quick check first
      if (!isAuthenticated()) {
        setIsValid(false);
        setIsVerifying(false);
        return;
      }

      // Verify with server
      try {
        const result = await verifyToken();
        if (result.success && result.user && result.user.status === "approved") {
          setIsValid(true);
        } else {
          clearAuth();
          setIsValid(false);
        }
      } catch {
        clearAuth();
        setIsValid(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [location.pathname]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-terminal-green animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Memverifikasi akun...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
