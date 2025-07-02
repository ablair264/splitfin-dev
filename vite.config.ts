import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Workaround for tinyglobby .mjs file import
      {
        find: /^tinyglobby\/dist\/index\.mjs$/,
        replacement: 'tinyglobby/dist/index.js',
      },
    ],
  },
  server: {
    proxy: {
      // Forward API calls to Zoho proxy server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Forward OAuth callback to Zoho proxy server
      '/oauth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});