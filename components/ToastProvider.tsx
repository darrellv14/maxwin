import React, { createContext, useContext, useCallback } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { X } from "lucide-react";

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
        const options = {
          duration: type === "loading" ? Infinity : 4000,
        };
        if (type === "success") toast.success(message, options);
        else if (type === "error") toast.error(message, options);
        else toast.loading(message, options);
      },
    };
  }
  return context;
};

// Custom toast component with close button
const CustomToast: React.FC<{
  message: string;
  type: "success" | "error" | "loading";
  toastId: string;
}> = ({ message, type, toastId }) => {
  const iconColor = type === "success" ? "#00ff9d" : type === "error" ? "#ff0055" : "#fbbf24";
  
  return (
    <div className="flex items-center gap-3 w-full">
      <span className="flex-1">{message}</span>
      <button
        onClick={() => toast.dismiss(toastId)}
        className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-gray-400 hover:text-white" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "loading" = "success") => {
      const options = {
        duration: type === "loading" ? Infinity : 4000,
      };
      if (type === "success") toast.success(message, options);
      else if (type === "error") toast.error(message, options);
      else toast.loading(message, options);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster
        position="top-center"
        containerStyle={{
          top: 60,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1a1a2e",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "monospace",
            maxWidth: "90vw",
            padding: "10px 14px",
            paddingRight: "8px",
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
      >
        {(t) => (
          <div
            className={`flex items-center gap-2 ${t.visible ? "animate-enter" : "animate-leave"}`}
          >
            <span className="flex-1">{t.message as string}</span>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0 ml-2"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
            </button>
          </div>
        )}
      </Toaster>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
