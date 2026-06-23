/**
 * Extract HIGH_CITY_VISUAL_LANDMARKS placements from highCityVisualLandmarks.ts.
 * Shared by port-azura-placements.mjs and verify-web-visual-assets.mjs.
 */
export function extractHighCityLandmarkPlacements(source, { idPrefix = 'high-city' } = {}) {
  const start = source.indexOf('const HIGH_CITY_VISUAL_LANDMARKS');
  const end = source.indexOf('export function highCityVisualLandmarksForMap');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('could not find HIGH_CITY_VISUAL_LANDMARKS section');
  }
  const section = source.slice(start, end);
  const placements = [];
  const instanceCounts = new Map();

  function add(assetId, x, y, prefix, explicitInstance = null) {
    const key = `${assetId}:${x}:${y}`;
    let instance;
    if (explicitInstance != null) {
      instance = explicitInstance;
      instanceCounts.set(key, explicitInstance + 1);
    } else {
      instance = instanceCounts.get(key) ?? 0;
      instanceCounts.set(key, instance + 1);
    }
    placements.push({
      id: `${prefix}:${assetId}:${x}:${y}:${instance}`,
      asset_id: assetId,
      x,
      y,
    });
  }

  let match;
  const objRe = /obj\('([^']+)',\s*(\d+),\s*(\d+)(?:,\s*(\d+))?(?:,\s*'([^']+)')?\)/g;
  while ((match = objRe.exec(section))) {
    const explicit = match[4] !== undefined ? Number(match[4]) : null;
    const prefix = match[5] ?? idPrefix;
    add(match[1], Number(match[2]), Number(match[3]), prefix, explicit);
  }

  const rowRe = /\.\.\.row\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)/g;
  while ((match = rowRe.exec(section))) {
    const prefix = match[5] ?? idPrefix;
    for (let x = Number(match[2]); x <= Number(match[3]); x += 1) {
      add(match[1], x, Number(match[4]), prefix);
    }
  }

  const colRe = /\.\.\.col\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)/g;
  while ((match = colRe.exec(section))) {
    const prefix = match[5] ?? idPrefix;
    for (let y = Number(match[3]); y <= Number(match[4]); y += 1) {
      add(match[1], Number(match[2]), y, prefix);
    }
  }

  const patchRe =
    /\.\.\.floorPatch\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*'([^']+)')?\)/g;
  while ((match = patchRe.exec(section))) {
    const prefix = match[6] ?? idPrefix;
    for (let y = Number(match[3]); y <= Number(match[5]); y += 1) {
      for (let x = Number(match[2]); x <= Number(match[4]); x += 1) {
        add(match[1], x, y, prefix);
      }
    }
  }

  return placements;
}