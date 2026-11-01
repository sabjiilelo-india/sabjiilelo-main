import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.VITE_DEV_API ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  // Brand artwork lives in the repo-level /public folder (logo, banners, 3D icons).
  publicDir: '../../public',
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/static': API,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
