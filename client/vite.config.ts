import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Same-origin /api in dev, so the server needs no CORS setup.
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
