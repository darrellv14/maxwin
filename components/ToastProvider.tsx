import React, { createContext, useContext, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error" | "loading") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a fallback that uses toast directly
    return {
      showToast: (message: string, type: "success" | "error" | "loading" = "success") => {
        if (type === "success") toast.success(message);
        else if (type === "error") toast.error(message);
        else toast.loading(message);
      },
    };
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "loading" = "success") => {
      if (type === "success") toast.success(message);
      else if (type === "error") toast.error(message);
      else toast.loading(message);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1a1a2e",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "8px",
            fontSize: "14px",
            fontFamily: "monospace",
          },
          success: {
            iconTheme: {
              primary: "#00ff9d",
              secondary: "#1a1a2e",
            },
            style: {
              borderColor: "#00ff9d33",
            },
          },
          error: {
            iconTheme: {
              primary: "#ff0055",
              secondary: "#1a1a2e",
            },
            style: {
              borderColor: "#ff005533",
            },
          },
          loading: {
            iconTheme: {
              primary: "#fbbf24",
              secondary: "#1a1a2e",
            },
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
