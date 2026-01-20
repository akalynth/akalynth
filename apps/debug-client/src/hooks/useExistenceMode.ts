/**
 * Existence Mode detection
 *
 * Enable via:
 * - URL: ?mode=existence
 * - Build-time: VITE_EXISTENCE_MODE=1
 */
export function useExistenceMode(): boolean {
  // Check URL query param
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'existence') return true;

  // Check build-time env var
  if (import.meta.env.VITE_EXISTENCE_MODE === '1') return true;

  return false;
}
