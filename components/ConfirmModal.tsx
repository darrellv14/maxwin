import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
}) => {
  const variantConfig = {
    danger: {
      icon: AlertTriangle,
      iconColor: "text-loss-red",
      iconBg: "bg-loss-red/10 border-loss-red/30",
      buttonColor: "bg-loss-red hover:bg-loss-red/90",
    },
    warning: {
      icon: AlertCircle,
      iconColor: "text-yellow-500",
      iconBg: "bg-yellow-500/10 border-yellow-500/30",
      buttonColor: "bg-yellow-500 hover:bg-yellow-500/90",
    },
    info: {
      icon: Info,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10 border-blue-400/30",
      buttonColor: "bg-blue-500 hover:bg-blue-500/90",
    },
    success: {
      icon: CheckCircle,
      iconColor: "text-profit-green",
      iconBg: "bg-profit-green/10 border-profit-green/30",
      buttonColor: "bg-profit-green hover:bg-profit-green/90 text-black",
    },
  };

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-terminal-gray border border-gray-800 rounded-xl p-4 sm:p-6 max-w-sm w-full"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center border ${config.iconBg}`}
              >
                <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white font-mono">{title}</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">{message}</p>
              </div>

              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex gap-2 sm:gap-3 mt-5 sm:mt-6">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-3 sm:px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs sm:text-sm font-mono text-gray-200 border border-gray-700 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-mono font-bold text-white transition-colors disabled:opacity-50 ${config.buttonColor}`}
              >
                {isLoading ? "Processing..." : confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
