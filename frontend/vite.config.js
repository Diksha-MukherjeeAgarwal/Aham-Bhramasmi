import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base keeps the build portable on GitHub Pages and Vercel.
  base: './',
  plugins: [react()],
});
