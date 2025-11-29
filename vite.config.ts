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
              // Charts need React, so bundle them together
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              // Lightweight charts (no React dependency)
              if (id.includes('lightweight-charts')) {
                return 'vendor-lw-charts';
              }
              // UI libraries
              if (id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // Finance/indicators
              if (id.includes('technicalindicators')) {
                return 'vendor-indicators';
              }
              // Other vendor libs
              if (id.includes('zustand') || id.includes('sonner') || id.includes('cmdk')) {
                return 'vendor-utils';
              }
              // Router
              if (id.includes('react-router')) {
                return 'vendor-router';
              }
            }
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
  };
});
