import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoReposRoot = path.resolve(__dirname, '../../../..');

export default defineConfig({
  base: process.env.AKALYNTH_CLIENT_BASE ?? '/play/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.mts', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    host: true,        // Expose to 0.0.0.0 for Codespaces
    strictPort: true,  // Fail if port taken
    fs: {
      allow: [
        path.resolve(__dirname, '../../..'),
        path.resolve(monorepoReposRoot, 'akalynth-site'),
        path.resolve(monorepoReposRoot, 'akalynth-codex'),
      ],
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
});
