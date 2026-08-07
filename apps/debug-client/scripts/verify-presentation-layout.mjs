import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/components/ActionsPanel.tsx'), 'utf8');

const source = `${css}\n${app}\n${actions}`;

const required = [
  'AKALYNTH_PRESENTATION_LAYOUT_REPAIR_V1',
  '.app-shell--presentation .stage-map',
  '.app-shell--presentation .map-canvas',
  'calc(100vw - 2rem)',
  'calc(100dvh - 11rem)',
  '.app-shell--presentation .hud-card--stats',
  '.hud-card--stats > .nine-slice-panel__content',
  '.app-shell--presentation .thumb-zone.right',
  '.app-shell--presentation .stage-bottom',
  'grid-template-columns: repeat(4, minmax(0, 1fr))',
  "type PresentationViewport = 'mobile-landscape' | 'compact-desktop' | 'desktop'",
  'app-shell--presentation-${presentationViewport}',
  'role="status" aria-label="Current objective"',
  'presentation-action-summary',
  'aria-describedby={ritualHintId}',
  'min-height: 48px',
  '.app-shell--presentation-compact-desktop',
];

const missing = required.filter((needle) => !source.includes(needle));
if (missing.length > 0) {
  console.error(`Presentation layout guard failed; missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Presentation layout guard passed.');
