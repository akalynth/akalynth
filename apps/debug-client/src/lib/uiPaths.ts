import { atlasPublicUrl } from './atlasPaths';

/**
 * Canonical loose UI chrome root in the monorepo (mirrored to clients by sync-to-clients).
 * Source authority: repos/akalynth/data/assets-built/ui/
 */
export const UI_BUILT_ROOT = 'data/assets-built/ui';

/** Public URL for a UI stem (e.g. ui_panel_frame) served from public/atlas/ui/. */
export function uiBuiltPublicUrl(stem: string): string {
  const normalized = stem.replace(/^ui\//, '').replace(/\.png$/i, '');
  return atlasPublicUrl(`ui/${normalized}.png`);
}