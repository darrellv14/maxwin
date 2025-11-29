import React, { createContext, useContext, useCallback } from "react";
import { Toaster, toast } from "sonner";

interface ToastContextValue {
  showToast: (message: string, type?: "success" | "error" | "loading" | "info") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return a fallback that uses toast directly
    return {
      showToast: (message: string, type: "success" | "error" | "loading" | "info" = "success") => {
        if (type === "success") toast.success(message);
        else if (type === "error") toast.error(message);
        else if (type === "loading") toast.loading(message);
        else toast.info(message);
      },
    };
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "loading" | "info" = "success") => {
      if (type === "success") toast.success(message);
      else if (type === "error") toast.error(message);
      else if (type === "loading") toast.loading(message);
      else toast.info(message);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster
        position="top-center"
        offset={16}
        gap={8}
        duration={4000}
        closeButton
        richColors
        theme="dark"
        toastOptions={{
          style: {
            background: "#1a1a2e",
            border: "1px solid #333",
            color: "#fff",
            fontFamily: "ui-monospace, monospace",
            fontSize: "13px",
          },
          classNames: {
            toast: "!bg-terminal-dark !border-gray-700",
            title: "!text-white !font-mono",
            description: "!text-gray-400",
            success: "!border-l-4 !border-l-profit-green",
            error: "!border-l-4 !border-l-loss-red",
            info: "!border-l-4 !border-l-blue-500",
            warning: "!border-l-4 !border-l-yellow-500",
            closeButton: "!bg-gray-800 !border-gray-700 !text-gray-400 hover:!text-white",
          },
        }}
      />
    </ToastContext.Provider>
  );
};

export default ToastProvider;
