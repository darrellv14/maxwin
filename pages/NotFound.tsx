import React from "react";
import { Link } from "react-router-dom";
import { Home, AlertTriangle } from "lucide-react";

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-1 bg-red-500 rounded-full opacity-20 blur-xl animate-pulse"></div>
            <AlertTriangle className="w-24 h-24 text-red-500 relative z-10" />
          </div>
        </div>

        <h1 className="text-6xl font-bold text-white tracking-tighter">404</h1>
        <h2 className="text-2xl font-semibold text-gray-300">Page Not Found</h2>

        <p className="text-gray-400 text-lg">
          Oops! The page you are looking for seems to have vanished into the void. It might have
          been moved, deleted, or never existed.
        </p>

        <div className="pt-6">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 gap-2 shadow-lg shadow-green-900/20"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
