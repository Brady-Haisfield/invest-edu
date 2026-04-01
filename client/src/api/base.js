// In dev, Vite proxies /api → localhost:3001 so this is empty.
// In production (Vercel), set VITE_API_BASE_URL to the Railway backend URL.
// e.g. VITE_API_BASE_URL=https://meridian-server.up.railway.app
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
