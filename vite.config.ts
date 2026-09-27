import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    target: 'es2020',
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  plugins: [react(), tailwindcss()],
  server: { proxy: { '/api': 'http://127.0.0.1:3001', '/ws': { target: 'ws://127.0.0.1:3001', ws: true } } } });
