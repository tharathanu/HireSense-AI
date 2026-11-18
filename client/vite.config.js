import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // TensorFlow.js is large but only loads during proctored rounds
    chunkSizeWarningLimit: 1500,
  },
});
