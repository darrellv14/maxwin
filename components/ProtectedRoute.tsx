import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, isAdmin, verifyToken, getUser, clearAuth } from "../services/authService";
import { MooCuanSpinner } from "./MooCuanSpinner";

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
    return <MooCuanSpinner fullScreen size="lg" text="Memverifikasi akun..." />;
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
