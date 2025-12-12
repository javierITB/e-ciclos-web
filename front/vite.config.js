import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configuración del proxy: Reenvía peticiones que empiecen por /api
    proxy: {
      '/api': {
        target: "http://127.0.0.1:5000", // Dirección de tu servidor Flask
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // Opcional: Remueve /api del path final de Flask
      },
    },
  },
});