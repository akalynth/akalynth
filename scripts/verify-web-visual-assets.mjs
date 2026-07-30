#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const tileSize = 32;
const ROOKGUARD_TUTORIAL_TILEMAP_TEST = 'data/assets-src/test-maps/rookguard-tutorial-assets-v1.json';
const errors = [];

function fail(message) {
  errors.push(message);
}

function abs(rel) {
  return resolve(root, rel);
}

function read(rel) {
  const p = abs(rel);
  if (!existsSync(p)) {
    fail(`${rel}: missing`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

function readJson(rel) {
  const raw = read(rel);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${rel}: invalid JSON (${err.message})`);
    return null;
  }
}

function assertContains(rel, text, needle, reason) {
  if (!text.includes(needle)) fail(`${rel}: expected ${reason}`);
}

function assertNotContains(rel, text, needle, reason) {
  if (text.includes(needle)) fail(`${rel}: must not contain ${reason}`);
}

function assertArrayEq(label, actual, expected) {
  const ok = Array.isArray(actual) && actual.length === expected.length && actual.every((value, i) => value === expected[i]);
  if (!ok) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTilemapTested(sidecarRel, manifest) {
  if (manifest.status !== 'tilemap_tested') fail(`${sidecarRel}: status must be tilemap_tested`);
  if (manifest.tilemap_test !== ROOKGUARD_TUTORIAL_TILEMAP_TEST) {
    fail(`${sidecarRel}: tilemap_test must be ${ROOKGUARD_TUTORIAL_TILEMAP_TEST}`);
    return;
  }
  const test = readJson(ROOKGUARD_TUTORIAL_TILEMAP_TEST);
  if (!test) return;
  const placements = Array.isArray(test.placements) ? test.placements : [];
  const placement = placements.find((entry) => entry?.asset_id === manifest.asset_id);
  if (!placement) fail(`${ROOKGUARD_TUTORIAL_TILEMAP_TEST}: missing placement for ${manifest.asset_id}`);
  else if (placement.mechanics !== null) fail(`${ROOKGUARD_TUTORIAL_TILEMAP_TEST}: ${manifest.asset_id} placement mechanics must be null`);
}

function spriteImportRels(rel, text) {
  const imports = [];
  const re = /from\s+['"]([^'"]*data\/assets-src\/sprites\/[^'"]+\.png)\?url['"]/g;
  let match;
  while ((match = re.exec(text))) {
    const spec = match[1];
    const idx = spec.indexOf('data/assets-src/sprites/');
    if (idx >= 0) imports.push(spec.slice(idx));
    else fail(`${rel}: could not resolve sprite import ${spec}`);
  }
  return imports;
}

function validateImportedSprite(rel, pngRel) {
  if (!existsSync(abs(pngRel))) {
    fail(`${rel}: imported sprite missing ${pngRel}`);
    return;
  }
  const sidecarRel = pngRel.replace(/\.png$/, '.json');
  if (!existsSync(abs(sidecarRel))) {
    fail(`${rel}: imported sprite missing sidecar ${sidecarRel}`);
    return;
  }
  const sidecar = readJson(sidecarRel);
  if (!sidecar) return;
  if (sidecar.mechanics !== null) fail(`${sidecarRel}: mechanics must be null`);
  if (pngRel.includes('/world/')) {
    if (sidecar.image !== pngRel.split('/').at(-1)) fail(`${sidecarRel}: image must match imported PNG basename`);
    if (sidecar.rendering?.display_only !== true) fail(`${sidecarRel}: rendering.display_only must be true`);
    if (sidecar.rendering?.filtering !== 'nearest') fail(`${sidecarRel}: rendering.filtering must be nearest`);
  } else if (sidecar.cleaned_file && sidecar.cleaned_file !== pngRel) {
    fail(`${sidecarRel}: cleaned_file must match imported PNG`);
  }
}

function collectImportedSprites(files) {
  const seen = new Set();
  for (const rel of files) {
    const text = read(rel);
    for (const pngRel of spriteImportRels(rel, text)) {
      if (seen.has(pngRel)) continue;
      seen.add(pngRel);
      validateImportedSprite(rel, pngRel);
    }
  }
}

function worldVisualSidecars() {
  const files = [
    'data/assets-src/sprites/world/castle/prison_bars.json',
    'data/assets-src/sprites/world/castle/stone_column.json',
    'data/assets-src/sprites/world/castle/throne.json',
    'data/assets-src/sprites/world/castle/weapon_rack.json',
    'data/assets-src/sprites/world/city_objects/banner_blue.json',
    'data/assets-src/sprites/world/city_objects/banner_red.json',
    'data/assets-src/sprites/world/city_objects/bench.json',
    'data/assets-src/sprites/world/city_objects/fountain.json',
    'data/assets-src/sprites/world/city_objects/notice_board.json',
    'data/assets-src/sprites/world/city_objects/rookguard_amber_lantern.json',
    'data/assets-src/sprites/world/city_objects/rookguard_bait_crate.json',
    'data/assets-src/sprites/world/city_objects/rookguard_canal_reeds.json',
    'data/assets-src/sprites/world/city_objects/rookguard_fishing_post.json',
    'data/assets-src/sprites/world/city_objects/rookguard_supply_sack.json',
    'data/assets-src/sprites/world/city_objects/rookguard_waymarker.json',
    'data/assets-src/sprites/world/doors/door_wood_closed_east.json',
    'data/assets-src/sprites/world/doors/door_wood_closed_south.json',
    'data/assets-src/sprites/world/doors/door_wood_open_east.json',
    'data/assets-src/sprites/world/doors/door_wood_open_south.json',
    'data/assets-src/sprites/world/interior/bed_single.json',
    'data/assets-src/sprites/world/interior/bookshelf.json',
    'data/assets-src/sprites/world/interior/chair_wood.json',
    'data/assets-src/sprites/world/interior/chest_small.json',
    'data/assets-src/sprites/world/interior/fireplace.json',
    'data/assets-src/sprites/world/interior/table_small.json',
    'data/assets-src/sprites/world/market/market_cloth_stall.json',
    'data/assets-src/sprites/world/market/market_food_stall.json',
    'data/assets-src/sprites/world/roofs/market_awning_overlay.json',
    'data/assets-src/sprites/world/roofs/roof_castle_overlay.json',
    'data/assets-src/sprites/world/roofs/roof_red_large_overlay.json',
    'data/assets-src/sprites/world/roofs/roof_red_small_overlay.json',
    'data/assets-src/sprites/world/sewer/sewer_grate.json',
    'data/assets-src/sprites/world/sewer/sewer_pipe.json',
    'data/assets-src/sprites/world/sewer/slime_pool.json',
    'data/assets-src/sprites/world/terrain/floor_cobble_01.json',
    'data/assets-src/sprites/world/terrain/floor_stone_01.json',
    'data/assets-src/sprites/world/terrain/floor_wood_01.json',
    'data/assets-src/sprites/world/terrain/grass_01.json',
    'data/assets-src/sprites/world/walls/wall_stone_corner_ne.json',
    'data/assets-src/sprites/world/walls/wall_stone_corner_nw.json',
    'data/assets-src/sprites/world/walls/wall_stone_north.json',
    'data/assets-src/sprites/world/walls/wall_stone_south.json',
  ];
  const byId = new Map();
  for (const rel of files) {
    const value = readJson(rel);
    if (!value) continue;
    if (typeof value.id !== 'string') fail(`${rel}: id required`);
    else byId.set(value.id, { rel, value });
  }
  return byId;
}

function extractRookguardPlacements(source) {
  const start = source.indexOf('const ROOKGUARD_VISUAL_LANDMARKS');
  const end = source.indexOf('const HIGH_CITY_VISUAL_LANDMARKS');
  if (start < 0 || end < 0 || end <= start) {
    fail('apps/debug-client/src/data/highCityVisualLandmarks.ts: could not find Rookguard placement section');
    return [];
  }
  const section = source.slice(start, end);
  const placements = [];

  function add(assetId, x, y, sourceExpr) {
    placements.push({ assetId, x, y, sourceExpr });
  }

  let match;
  const objRe = /obj\('([^']+)',\s*(\d+),\s*(\d+)(?:,\s*\d+)?(?:,\s*'rookguard')?\)/g;
  while ((match = objRe.exec(section))) add(match[1], Number(match[2]), Number(match[3]), match[0]);

  const rowRe = /\.\.\.row\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*'rookguard'\)/g;
  while ((match = rowRe.exec(section))) {
    for (let x = Number(match[2]); x <= Number(match[3]); x += 1) add(match[1], x, Number(match[4]), match[0]);
  }

  const colRe = /\.\.\.col\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*'rookguard'\)/g;
  while ((match = colRe.exec(section))) {
    for (let y = Number(match[3]); y <= Number(match[4]); y += 1) add(match[1], Number(match[2]), y, match[0]);
  }

  const patchRe = /\.\.\.floorPatch\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'rookguard'\)/g;
  while ((match = patchRe.exec(section))) {
    for (let y = Number(match[3]); y <= Number(match[5]); y += 1) {
      for (let x = Number(match[2]); x <= Number(match[4]); x += 1) add(match[1], x, y, match[0]);
    }
  }

  return placements;
}

function anchorPoint(placement, rendering) {
  const left = placement.x * tileSize;
  const top = placement.y * tileSize;
  switch (rendering.anchor?.type) {
    case 'tile_top_left':
      return { x: left, y: top };
    case 'bottom_left':
      return { x: left, y: top + tileSize };
    case 'center':
      return { x: left + tileSize / 2, y: top + tileSize / 2 };
    case 'bottom_center':
    default:
      return { x: left + tileSize / 2, y: top + tileSize };
  }
}

function drawRectForPlacement(placement, def) {
  const rendering = def.rendering;
  const scale = rendering?.draw_scale;
  const frame = def.frame;
  const sourcePixels = rendering?.anchor?.source_pixels;
  if (!frame || !Array.isArray(sourcePixels) || typeof scale !== 'number') return null;
  const anchor = anchorPoint(placement, rendering);
  return {
    x: Math.round(anchor.x - sourcePixels[0] * scale),
    y: Math.round(anchor.y - sourcePixels[1] * scale),
    width: frame.width * scale,
    height: frame.height * scale,
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validateAzuraPlacementArtifacts() {
  const landmarksBuilt = 'data/assets-built/placements/azura-overlays.json';
  const mergedBuilt = 'data/assets-built/placements/azura-all-overlays.json';
  const landmarks = readJson(landmarksBuilt);
  const merged = readJson(mergedBuilt);
  if (!landmarks) return;
  if (!merged) return;

  if (landmarks.map !== 'azura') fail(`${landmarksBuilt}: map must be azura`);
  if (merged.map !== 'azura') fail(`${mergedBuilt}: map must be azura`);
  if (landmarks.mechanics !== null) fail(`${landmarksBuilt}: mechanics must be null`);
  if (merged.mechanics !== null) fail(`${mergedBuilt}: mechanics must be null`);

  const landmarkCount = Array.isArray(landmarks.placements) ? landmarks.placements.length : 0;
  const mergedCount = Array.isArray(merged.placements) ? merged.placements.length : 0;
  if (landmarkCount < 1450) {
    fail(`${landmarksBuilt}: expected >=1450 landmark placements, got ${landmarkCount}`);
  }
  if (mergedCount < 1500) {
    fail(`${mergedBuilt}: expected >=1500 merged placements, got ${mergedCount}`);
  }

  const androidRepoRel = 'apps/android/app/src/main/java/com/akalynth/client/game/WorldPlacementRepository.kt';
  const androidRepo = read(androidRepoRel);
  assertContains(
    androidRepoRel,
    androidRepo,
    'placements/azura-all-overlays.json',
    'Android Azura placement bundle path',
  );

  for (const file of [landmarksBuilt, mergedBuilt]) {
    const manifest = readJson(file);
    if (!manifest) continue;
    for (const placement of manifest.placements) {
      if (!placement?.asset_id || !Number.isInteger(placement.x) || !Number.isInteger(placement.y)) {
        fail(`${file}: invalid placement entry ${JSON.stringify(placement)}`);
      }
    }
  }

  const requiredAnchors = [
    ['high_city_crystal_fountain', 32, 33],
    ['high_city_lantern_post', 32, 40],
    ['high_city_sigil_banner_blue', 26, 32],
    ['market_food_stall', 44, 26],
    ['throne', 60, 7],
  ];
  for (const [assetId, x, y] of requiredAnchors) {
    if (!merged.placements.some((p) => p.asset_id === assetId && p.x === x && p.y === y)) {
      fail(`${mergedBuilt}: missing anchor ${assetId} at ${x},${y}`);
    }
  }
}

function validateRookguardTutorialVisibility() {
  const landmarksRel = 'apps/debug-client/src/data/highCityVisualLandmarks.ts';
  const source = read(landmarksRel);
  assertContains(landmarksRel, source, "if (mapName === 'Rookguard') return ROOKGUARD_VISUAL_LANDMARKS", 'Rookguard visual placement hook');
  assertContains(landmarksRel, source, 'leave tutorial-code tiles', 'tutorial tile visibility comment');

  const map = readJson('packages/shared/maps/rookguard.json');
  if (!map) return;
  const tutorialTiles = [];
  for (let i = 0; i < map.tiles.length; i += 1) {
    const code = map.tiles[i];
    if (code >= 5 && code <= 8) {
      tutorialTiles.push({
        x: (i % map.width) * tileSize,
        y: Math.floor(i / map.width) * tileSize,
        width: tileSize,
        height: tileSize,
        code,
      });
    }
  }
  const expectedCodes = tutorialTiles.map((tile) => tile.code).sort((a, b) => a - b);
  assertArrayEq('packages/shared/maps/rookguard.json: tutorial tile codes', expectedCodes, [5, 6, 7, 8]);

  const defs = worldVisualSidecars();
  const placements = extractRookguardPlacements(source);
  for (const placement of placements) {
    const entry = defs.get(placement.assetId);
    if (!entry) {
      fail(`${landmarksRel}: unknown Rookguard visual asset ${placement.assetId}`);
      continue;
    }
    const def = entry.value;
    if (def.mechanics !== null) fail(`${entry.rel}: mechanics must be null`);
    if (def.rendering?.display_only !== true) fail(`${entry.rel}: rendering.display_only must be true`);
    const rect = drawRectForPlacement(placement, def);
    if (!rect) {
      fail(`${entry.rel}: cannot compute draw rectangle`);
      continue;
    }
    for (const tile of tutorialTiles) {
      if (overlaps(rect, tile)) {
        fail(`${landmarksRel}: ${placement.sourceExpr} draws over Rookguard tutorial/gate tile code ${tile.code} at ${tile.x / tileSize},${tile.y / tileSize}`);
      }
    }
  }
}

function validateTutorialTileSprites() {
  const rel = 'apps/debug-client/src/hooks/useTileSprites.ts';
  const source = read(rel);
  const required = [
    ['tutorialMoveTile', 'tile__tutorial_move.png?url', 'TileCode.TutorialMove', 5],
    ['tutorialChatTile', 'tile__tutorial_chat.png?url', 'TileCode.TutorialChat', 6],
    ['tutorialTemTile', 'tile__tutorial_tem.png?url', 'TileCode.TutorialTem', 7],
    ['gateToAzuraTile', 'tile__gate_to_azura.png?url', 'TileCode.GateToAzura', 8],
  ];
  for (const [variable, file, tileCodeName, tileCode] of required) {
    assertContains(rel, source, variable, `${file} import`);
    assertContains(rel, source, `[${tileCodeName}]: ${variable}`, `${tileCodeName} sprite mapping`);
    const sidecarRel = `data/assets-src/sprites/${file.replace('.png?url', '.json')}`;
    const manifest = readJson(sidecarRel);
    if (!manifest) continue;
    if (manifest.tile_code !== tileCode) fail(`${sidecarRel}: tile_code must be ${tileCode}`);
    if (manifest.mechanics !== null) fail(`${sidecarRel}: mechanics must be null`);
    assertTilemapTested(sidecarRel, manifest);
  }
}

function validateAppUsesWorldVisuals() {
  const appRel = 'apps/debug-client/src/App.tsx';
  const app = read(appRel);
  assertContains(appRel, app, 'highCityVisualLandmarksForMap', 'map visual placement selection');
  assertContains(appRel, app, 'worldVisualObjects={worldVisualObjects}', 'MapCanvas visual object wiring');

  const canvasRel = 'apps/debug-client/src/components/MapCanvas.tsx';
  const canvas = read(canvasRel);
  assertContains(canvasRel, canvas, 'useWorldVisualAssets', 'world visual image preloader');
  assertContains(canvasRel, canvas, 'REGISTRY_WORLD_VISUAL_ASSETS', 'registry-backed object rendering');
  assertContains(canvasRel, canvas, 'creature__rookguard_training_slime.png?url', 'training slime source sprite');
}

function validateMobilePlayShellContract() {
  const appRel = 'apps/debug-client/src/App.tsx';
  const app = read(appRel);
  assertContains(appRel, app, 'function MobileLandscapeGate()', 'mobile portrait rotate gate component');
  assertContains(appRel, app, 'function displayConnectionLabel(conn: ConnectionState): string', 'player-readable connection label helper');
  assertContains(appRel, app, "if (conn.phase === 'error') return 'offline';", 'mobile error connection label is player-readable');
  assertContains(appRel, app, '<strong>{displayConnectionLabel(state.conn)}</strong>', 'desktop stats connection label is player-readable');
  assertContains(appRel, app, 'className="mobile-rotate-gate"', 'mobile rotate gate class');
  assertContains(appRel, app, 'function MobilePlayEntry', 'mobile account/world entry component');
  assertContains(appRel, app, 'className="mobile-enter-play-btn"', 'mobile enter play button');
  assertContains(appRel, app, 'mobile-play-entry__conn--${conn.phase}', 'entry connection phase class');
  assertContains(appRel, app, 'const accountPanelMode = !presentationMode && !state.session.authenticated;', 'signed-out account panel mode');
  assertContains(appRel, app, "accountPanelMode ? ' app-shell--account-panel' : ''", 'account panel app shell class');
  assertContains(appRel, app, 'disabled={!hasWorldPlayer}', 'mobile entry stays disabled until a world player exists');
  assertContains(appRel, app, "aria-label={hasWorldPlayer ? 'Enter play mode' : 'Waiting for world before entering play'}", 'mobile entry accessible waiting label');
  assertContains(appRel, app, 'const hasWorldPlayer = Boolean(state.world.me);', 'world-player presence gate');
  assertContains(appRel, app, 'const presentationEntryMode = presentationMode && !hasWorldPlayer;', 'presentation first-run entry mode');
  assertContains(appRel, app, 'const showPlayShell = hasWorldPlayer && (presentationMode || state.ui.stage >= 1);', 'play controls gated by world player in every mode');
  assertContains(appRel, app, '(state.ui.stage < 1 || !hasWorldPlayer)', 'mobile play entry clears after a world-backed entry');
  assertNotContains(appRel, app, '(state.ui.stage < 1 || !hasWorldPlayer || accountPanelMode)', 'mobile play entry held open by account panel mode after play starts');
  assertContains(appRel, app, '{showPlayEntry && (', 'account/world entry render branch');
  assertContains(appRel, app, '!presentationEntryMode && !phoneLandscape', 'desktop HUD stays out of mobile landscape play surface');
  assertContains(appRel, app, '{presentationMode && showPlayShell && (', 'presentation objective rail waits for world player');
  assertContains(appRel, app, '<DPad onMove={api.sendMove} onRelease={api.releaseMove} onStopAll={api.stopMoves} />', 'DPad remains intent-only movement control');
  assertContains(appRel, app, '<ActionsPanel', 'primary action panel remains wired');

  const presentationRel = 'apps/debug-client/src/hooks/usePresentationMode.ts';
  const presentation = read(presentationRel);
  assertContains(presentationRel, presentation, "new Set(['beta.akalynth.com', 'staging.akalynth.com'])", 'live lane presentation host allowlist');
  assertContains(presentationRel, presentation, "if (params.get('presentation') === '0') return false;", 'local QA can disable presentation mode');
  assertContains(presentationRel, presentation, 'if (params.has(\'presentation\')) return true;', 'presentation query flag');
  assertContains(presentationRel, presentation, 'return isLiveLaneHost();', 'presentation defaults on live lanes');

  const smokeRel = 'apps/debug-client/scripts/mobile-playable-smoke.mjs';
  const smoke = read(smokeRel);
  assertContains(smokeRel, smoke, 'const mobileEntryState = async () => evalJson', 'mobile smoke entry-state inspection');
  assertContains(smokeRel, smoke, 'account_gate_hides_play_controls_until_world_player_exists', 'mobile smoke account/world gate proof');
  assertContains(smokeRel, smoke, 'rawFetchErrorVisible', 'mobile smoke raw fetch error visibility probe');
  assertContains(smokeRel, smoke, 'connectionLabel', 'mobile smoke player-readable connection label probe');
  assertContains(smokeRel, smoke, 'desktop_connection_label_is_player_readable', 'desktop smoke player-readable connection label proof');
  assertContains(smokeRel, smoke, 'desktop_presentation_hides_debug_chrome', 'desktop presentation smoke hides debug chrome proof');
  assertContains(smokeRel, smoke, 'desktop_presentation_signed_out_hides_play_controls_until_world_player_exists', 'desktop presentation smoke account/world gate proof');
  assertContains(smokeRel, smoke, '--expect-playable', 'mobile smoke playable expectation option');
  assertContains(smokeRel, smoke, 'playable_world_expected_but_entry_was_gated', 'mobile smoke fake-playable gate failure proof');
  assertContains(smokeRel, smoke, 'playable_world_entry_controls_visible_after_server_world_state', 'mobile smoke server-world playable control proof');
  assertContains(smokeRel, smoke, 'desktop_presentation_world_player_shows_play_controls', 'desktop presentation fake-playable control proof');
  assertContains(smokeRel, smoke, 'entryWithinViewport', 'desktop presentation entry viewport proof');
  assertContains(smokeRel, smoke, 'entryTextFits', 'desktop presentation entry text-fit proof');
  assertContains(smokeRel, smoke, 'entryOverlapsTopBar', 'desktop presentation entry top-bar overlap proof');
  assertContains(smokeRel, smoke, 'account_gate_uses_player_readable_service_status', 'mobile smoke player-readable account service status proof');
  assertContains(smokeRel, smoke, 'withinEntry', 'mobile smoke account text stays inside entry panel proof');
  assertContains(smokeRel, smoke, "await waitVisible('.dpad', 'dpad_visible_after_entry');", 'mobile smoke playable-session DPad proof');
  assertContains(smokeRel, smoke, "await waitVisible('.command-dock', 'mobile_dock_visible_after_entry');", 'mobile smoke playable-session command dock proof');
  assertContains(smokeRel, smoke, 'dpad_real_pointer_tap_and_stop_exercised', 'mobile smoke real pointer movement proof');
  assertContains(smokeRel, smoke, 'Input.dispatchMouseEvent', 'mobile smoke uses browser input for DPad proof');
  assertContains(smokeRel, smoke, "await screenshot('02_landscape_account_gate_932x430.png'", 'mobile smoke account-gate screenshot');
  assertContains(smokeRel, smoke, 'desktop_account_panel_and_stats_fit_viewport', 'desktop signed-out panel viewport-fit proof');

  const gameClientRel = 'apps/debug-client/src/hooks/useGameClient.ts';
  const gameClient = read(gameClientRel);
  assertContains(gameClientRel, gameClient, 'ACCOUNT_SERVICE_UNAVAILABLE_MESSAGE', 'player-readable account-service outage message');
  assertContains(gameClientRel, gameClient, 'CHARACTER_OPTIONS_UNAVAILABLE_MESSAGE', 'player-readable character-options outage message');
  assertContains(gameClientRel, gameClient, 'function isBrowserNetworkError', 'network error normalization helper');
  assertContains(gameClientRel, gameClient, 'error: characterOptionsErrorMessage(err)', 'catalog network error copy normalization');
  assertContains(gameClientRel, gameClient, "message: accountServiceErrorMessage(err, 'Could not confirm account session')", 'account-session network error copy normalization');

  const rootPackageRel = 'package.json';
  const rootPackage = readJson(rootPackageRel);
  if (rootPackage?.scripts?.['smoke:web-play-shell'] !== 'node scripts/smoke-web-play-shell.mjs') {
    fail(`${rootPackageRel}: expected smoke:web-play-shell root command`);
  }

  const webShellSmokeRel = 'scripts/smoke-web-play-shell.mjs';
  const webShellSmoke = read(webShellSmokeRel);
  assertContains(webShellSmokeRel, webShellSmoke, "const viteCli = path.join(debugClientRoot, 'node_modules/vite/bin/vite.js');", 'root web smoke resolves debug-client Vite directly');
  assertContains(webShellSmokeRel, webShellSmoke, "process.execPath", 'root web smoke launches Vite without an orphaning package-manager wrapper');
  assertContains(webShellSmokeRel, webShellSmoke, 'apps/debug-client/scripts/mobile-playable-smoke.mjs', 'root web smoke runs mobile playable smoke');
  assertContains(webShellSmokeRel, webShellSmoke, 'AKALYNTH_WEB_PLAY_SHELL_SMOKE_V1', 'root web smoke writes stable report id');
  assertContains(webShellSmokeRel, webShellSmoke, '--fake-playable', 'root web smoke supports source-only fake playable peer');
  assertContains(webShellSmokeRel, webShellSmoke, 'startFakePlayableServer', 'root web smoke starts fake playable peer');
  assertContains(webShellSmokeRel, webShellSmoke, 'received_move_intent', 'root web smoke records client movement intent against fake peer');
  assertContains(webShellSmokeRel, webShellSmoke, 'VITE_HTTP_BASE', 'root web smoke points debug client HTTP at fake peer');
  assertContains(webShellSmokeRel, webShellSmoke, 'VITE_WS_BASE', 'root web smoke points debug client WS at fake peer');
  assertContains(webShellSmokeRel, webShellSmoke, 'Local source preview only', 'root web smoke documents non-runtime boundary');

  const spineRel = 'packages/verification-spine/src/verifiers.ts';
  const spine = read(spineRel);
  assertContains(spineRel, spine, 'const webPlayShellVerifier: VerifierSpec', 'web play shell verifier declaration');
  assertContains(spineRel, spine, "id: 'web-play-shell'", 'web play shell verifier id');
  assertContains(spineRel, spine, "title: 'Web Play Shell Smoke'", 'web play shell verifier title');
  assertContains(spineRel, spine, 'phase: 3', 'web play shell verifier phase');
  assertContains(spineRel, spine, "dependsOn: ['web-visual-assets']", 'web play shell verifier dependency');
  assertContains(spineRel, spine, 'auditSafe: false', 'web play shell verifier audit boundary');
  assertContains(spineRel, spine, "['run', 'smoke:web-play-shell'", 'web play shell verifier smoke command');
  assertContains(spineRel, spine, 'registry.register(webPlayShellVerifier)', 'web play shell verifier registration');

  const characterBarRel = 'apps/debug-client/src/components/CharacterBar.tsx';
  const characterBar = read(characterBarRel);
  assertContains(characterBarRel, characterBar, "character-bar--session-required", 'signed-out character form state class');
  assertNotContains(characterBarRel, characterBar, "document.createElement('style')", 'runtime style injection');
  assertNotContains(characterBarRel, characterBar, 'character-bar-styles', 'runtime style injection marker');

  const topBarRel = 'apps/debug-client/src/components/TopBar.tsx';
  const topBar = read(topBarRel);
  assertContains(topBarRel, topBar, 'function connectionLabel(conn: ConnectionState): string', 'top bar player-readable connection label helper');
  assertContains(topBarRel, topBar, "if (conn.phase === 'error') return 'Offline';", 'top bar error connection label is player-readable');
  assertContains(topBarRel, topBar, "if (conn.phase === 'awaiting_world_state') return 'Syncing';", 'top bar awaiting state is player-readable');
  assertContains(topBarRel, topBar, 'const label = connectionLabel(conn);', 'top bar uses connection label helper');
  assertContains(topBarRel, topBar, '{label}', 'top bar renders player-readable connection label');
  assertContains(topBarRel, topBar, '{!presentationMode && (\n        <div className="map-switcher">', 'presentation mode hides debug map switcher');

  const cssRel = 'apps/debug-client/src/index.css';
  const css = read(cssRel);
  assertContains(cssRel, css, '.character-bar {', 'static account character form CSS');
  assertContains(cssRel, css, '.mobile-play-entry .character-bar {\n    display: flex;', 'mobile entry overrides desktop character grid');
  assertContains(cssRel, css, '.app-shell--entry .mobile-play-entry .character-bar {\n    display: flex;', 'mobile entry wins over app-shell entry character grid');
  assertContains(cssRel, css, '.app-shell--entry .mobile-play-entry .character-bar--session-required .character-bar-input', 'mobile signed-out gate hides disabled setup inputs');
  assertContains(cssRel, css, '.app-shell--account-panel:not(.app-shell--presentation):not(.app-shell--entry) .hud-primary', 'signed-out desktop account panel layout');
  assertContains(cssRel, css, '.app-shell--presentation .inventory-toggle {\n  display: block;', 'presentation mode keeps Pack button visible');
  assertContains(cssRel, css, '.app-shell--presentation.app-shell--entry .mobile-play-entry {\n  position: fixed;', 'presentation first-run entry panel layout');
  assertContains(cssRel, css, '.app-shell--presentation.app-shell--entry .mobile-play-entry .character-bar--session-required .character-bar-input', 'presentation signed-out gate hides disabled setup inputs');
  assertContains(cssRel, css, '.mobile-play-entry__header .mobile-play-entry__conn--error', 'entry error connection phase styling');
  assertContains(cssRel, css, '.mobile-play-entry__header .mobile-play-entry__conn--disconnected', 'entry disconnected connection phase styling');
}

collectImportedSprites([
  'apps/debug-client/src/components/MapCanvas.tsx',
  'apps/debug-client/src/data/worldVisualAssets.ts',
  'apps/debug-client/src/data/extendedWorldVisualAssets.ts',
  'apps/debug-client/src/hooks/useTileSprites.ts',
]);
validateTutorialTileSprites();
validateRookguardTutorialVisibility();
validateAzuraPlacementArtifacts();
validateAppUsesWorldVisuals();
validateMobilePlayShellContract();

if (errors.length > 0) {
  console.error(`\nX verify:web-visual-assets - ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('✓ verify:web-visual-assets - web client visual assets are wired, display-only, and tutorial runes stay visible');
