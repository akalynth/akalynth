/** Preview lanes on the separated ops/K8s node — receipt-gated builder flow only. */
export type StudioPreviewEnv = 'Local' | 'Beta' | 'Staging';

export const PREVIEW_ENV_CYCLE: Record<StudioPreviewEnv, StudioPreviewEnv> = {
  Local: 'Beta',
  Beta: 'Staging',
  Staging: 'Local',
};

/** Production is direct on akalynth-prod-01 — not on the preview node, not env-cycled. */
export const PRODUCTION_PLAY_URL = 'https://akalynth.com/play/';

export function previewApiBase(env: StudioPreviewEnv, hostname = window.location.hostname, protocol = window.location.protocol): string {
  const configured = import.meta.env.VITE_STUDIO_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  switch (env) {
    case 'Beta':
      return 'https://beta-api.akalynth.com';
    case 'Staging':
      return 'https://staging-api.akalynth.com';
    default:
      return `${protocol}//${hostname}:3010`;
  }
}