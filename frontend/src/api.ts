const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error('VITE_BACKEND_URL not configured');
}

export const API_BASE: string = BACKEND_URL;
