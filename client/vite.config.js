import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // permite abrir la app desde el celular en la misma red (para probar el QR)
    proxy: { '/api': 'http://localhost:4000' },
  },
});
