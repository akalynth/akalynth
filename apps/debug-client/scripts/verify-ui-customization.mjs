import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const hook = fs.readFileSync(path.join(root, 'src/hooks/useUiLayout.ts'), 'utf8');
const topBar = fs.readFileSync(path.join(root, 'src/components/TopBar.tsx'), 'utf8');
const chrome = fs.readFileSync(path.join(root, 'src/components/HudChromePanel.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const smoke = fs.readFileSync(path.resolve(root, '../../scripts/smoke-web-play-shell.mjs'), 'utf8');
const mobileSmoke = fs.readFileSync(path.join(root, 'scripts/mobile-playable-smoke.mjs'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');

const required = [
  'AKALYNTH_CUSTOMIZABLE_HUD_V1',
  'AKALYNTH_MODERN_GAME_HUD_V1',
  'useUiLayout',
  'app-shell--modern',
  'app-shell--customize',
  'data-ui-panel="hud"',
  'data-ui-panel="controls"',
  'data-ui-panel="dock"',
  'window.localStorage',
  "'portrait' | 'landscape'",
  'window.addEventListener(\'pointermove\'',
  'window.addEventListener(\'pointerup\'',
  'layout-toggle',
  'onToggleCustomize',
  'touch-action: none',
  'min-width: 44px',
  'min-height: 52px',
  'AKALYNTH_BROWSER_SMOKE',
  'layout_drag_moves_topbar',
  'layout_position_persists_after_reload',
  'browser_console_errors_absent',
];

const source = `${app}\n${hook}\n${topBar}\n${chrome}\n${css}\n${smoke}\n${mobileSmoke}\n${vite}`;
const missing = required.filter((needle) => !source.includes(needle));
if (missing.length > 0) {
  console.error(`UI customization verifier failed; missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('UI customization verifier passed.');
