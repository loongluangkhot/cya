import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND_URL = process.env.BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('BACKEND_URL environment variable is required');
}

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // allows all hosts
  },
  define: {
    __BACKEND_URL__: JSON.stringify(BACKEND_URL),
  },
});
