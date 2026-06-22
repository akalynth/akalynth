/** Public atlas bundle paths (mirrored from data/assets-built/ via sync-to-clients). */

export function atlasPublicUrl(relPath: string): string {
  const normalized = relPath.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}atlas/${normalized}`;
}