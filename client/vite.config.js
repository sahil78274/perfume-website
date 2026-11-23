import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app is served on :5173 in development. All /api requests are
// proxied to the Express backend on :5000, so the browser only ever talks
// to one origin (cookies just work). For the production single-service
// deploy, `npm run build` produces client/dist which the server serves.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the preview/remote environment can reach it
    allowedHosts: ['.e2b.app'], // accept Arena's proxied preview hostname without allowing arbitrary hosts
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020'
  }
});
