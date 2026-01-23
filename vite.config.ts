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
      // Standard output configuration
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
