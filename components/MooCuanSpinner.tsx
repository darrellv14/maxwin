import React from "react";
import { motion } from "framer-motion";

const MOOCUAN_LOGO = "https://res.cloudinary.com/drvu0dpry/image/upload/v1764410228/moocuan-logo_ya5ous.png";

interface MooCuanSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
}

export const MooCuanSpinner: React.FC<MooCuanSpinnerProps> = ({
  size = "md",
  text,
  fullScreen = false,
}) => {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Glow effect */}
        <motion.div
          className={`absolute inset-0 bg-profit-green/30 rounded-full blur-xl ${sizeClasses[size]}`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Spinning ring */}
        <motion.div
          className={`absolute inset-0 ${sizeClasses[size]} border-2 border-transparent border-t-profit-green rounded-full`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Logo */}
        <motion.img
          src={MOOCUAN_LOGO}
          alt="Loading..."
          className={`${sizeClasses[size]} object-contain relative z-10`}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      
      {text && (
        <motion.p
          className="text-gray-400 font-mono text-sm"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-profit-green/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>
        {content}
      </div>
    );
  }

  return content;
};

// Simple inline spinner with logo (for buttons, etc)
export const MooCuanInlineSpinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <motion.img
    src={MOOCUAN_LOGO}
    alt="Loading..."
    className={`w-5 h-5 object-contain ${className}`}
    animate={{ rotate: [0, 360] }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

export default MooCuanSpinner;
