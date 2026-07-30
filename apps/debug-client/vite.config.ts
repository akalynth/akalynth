import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoReposRoot = path.resolve(__dirname, '../../../..');

function resolveCodexRoot(): string {
  const envRoot = process.env.AKALYNTH_CODEX_ROOT;
  const hasPublicGraph = (candidate: string) =>
    existsSync(path.join(candidate, 'out', 'codex-public.graph.json'));
  if (envRoot && hasPublicGraph(envRoot)) return envRoot;
  const candidates = [
    path.resolve(monorepoReposRoot, 'akalynth-codex'),
    path.resolve(__dirname, '../../../akalynth-codex'),
    '/home/sovereign/akalynth-ops/repos/akalynth-codex',
    path.resolve(__dirname, 'codex-fallback'),
  ];
  for (const candidate of candidates) {
    if (hasPublicGraph(candidate)) return candidate;
  }
  return candidates[0];
}

const codexRoot = resolveCodexRoot();

export default defineConfig({
  base: process.env.AKALYNTH_CLIENT_BASE ?? '/play/',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
      '@codex': codexRoot,
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
        codexRoot,
      ],
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
});
