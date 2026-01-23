import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
              return 'form-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            // Other vendor libraries
            return 'vendor';
          }
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Enable source maps only in development
    sourcemap: mode === 'development',
    // Use esbuild for faster builds and smaller bundles
    minify: mode === 'production' ? 'esbuild' : false,
    // Optimize chunk size warning
    chunkSizeWarningLimit: 600,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    // Exclude heavy dependencies from pre-bundling
    exclude: ['lucide-react'],
  },
  // CSS optimization
  css: {
    devSourcemap: false,
  },
}));
