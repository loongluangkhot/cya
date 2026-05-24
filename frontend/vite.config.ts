import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('BACKEND_URL environment variable is required');
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  define: {
    __BACKEND_URL__: JSON.stringify(BACKEND_URL),
  },
});
