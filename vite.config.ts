import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/_svc": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: "0.0.0.0",
      proxy: {
        "/_svc": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react-dom') || id.includes('/react/')) {
                return 'vendor-react';
              }
              // Router
              if (id.includes('react-router')) {
                return 'vendor-router';
              }
              // Charts - these are big
              if (id.includes('lightweight-charts') || id.includes('recharts')) {
                return 'vendor-charts';
              }
              // UI libraries
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // Finance/indicators - these are big
              if (id.includes('technicalindicators')) {
                return 'vendor-indicators';
              }
              // Other vendor libs
              if (id.includes('zustand') || id.includes('react-hot-toast') || id.includes('cmdk')) {
                return 'vendor-utils';
              }
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
