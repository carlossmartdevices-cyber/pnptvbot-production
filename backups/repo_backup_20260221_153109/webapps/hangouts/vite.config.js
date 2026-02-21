import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/hangouts/',
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          agora: ['agora-rtc-sdk-ng'],
          vendor: ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
});
