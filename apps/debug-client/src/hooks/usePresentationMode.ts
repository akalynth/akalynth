const LIVE_LANE_HOSTS = new Set(['beta.akalynth.com', 'staging.akalynth.com']);

export function isLiveLaneHost(hostname: string = window.location.hostname): boolean {
  return LIVE_LANE_HOSTS.has(hostname);
}

/**
 * Player-facing /play/ on beta and staging hides debug scaffolding.
 *
 * Enable via:
 * - Host: beta.akalynth.com or staging.akalynth.com
 * - URL: ?presentation=1
 * - Build-time: VITE_PRESENTATION_MODE=1
 *
 * Disable on live lanes for local QA: ?presentation=0
 */
export function usePresentationMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('presentation') === '0') return false;
  if (params.has('presentation')) return true;
  if (import.meta.env.VITE_PRESENTATION_MODE === '1') return true;
  return isLiveLaneHost();
}