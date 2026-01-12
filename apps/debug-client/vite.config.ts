import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  server: {
    port: 5173,
    host: true,        // Expose to 0.0.0.0 for Codespaces
    strictPort: true,  // Fail if port taken
  },
  preview: {
    port: 4173,
    host: true,
  },
});
