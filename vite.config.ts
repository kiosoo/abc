

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FIX: Replaced process.cwd() with '.' to avoid dependency on Node types
  // that are not being resolved in the environment.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        // FIX: Replaced process.cwd() with '.'
        '@': path.resolve('.'),
      },
    },
    server: {
      proxy: {
        // This proxies requests to /api to the Vercel dev server (or any other backend)
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    define: {
      // This makes the environment variable available on the client-side as process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
  };
});