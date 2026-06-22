import { useNineSliceWeb } from '../config';
import { NineSlicePanel } from './NineSlicePanel';
import { TextureCircle } from './TextureCircle';

/** Dev preview for PNG nine-slice chrome when VITE_USE_NINE_SLICE_WEB=true (PR-024). */
export function UiChromePreview() {
  if (!useNineSliceWeb()) return null;

  return (
    <section className="ui-chrome-preview" aria-label="PNG UI chrome preview">
      <header>
        <h2>PNG chrome (NineSlicePanel)</h2>
        <p>Compiled <code>ui_gameplay_v1</code> textures via registry.json — display-only.</p>
      </header>
      <div className="ui-chrome-preview__grid">
        <NineSlicePanel variant="panel" className="hud-card" padding={16} style={{ minWidth: 220 }}>
          <strong>Panel frame</strong>
          <span>ui_panel_frame · slice 8</span>
        </NineSlicePanel>
        <NineSlicePanel variant="dock" padding={14} style={{ minWidth: 180 }}>
          <span>Dock frame</span>
        </NineSlicePanel>
        <NineSlicePanel variant="button" padding={10} style={{ minWidth: 120 }}>
          <span>Button</span>
        </NineSlicePanel>
        <NineSlicePanel variant="button-pressed" padding={10} style={{ minWidth: 120 }}>
          <span>Pressed</span>
        </NineSlicePanel>
        <NineSlicePanel variant="dpad" padding={20} style={{ width: 168, height: 168 }}>
          <div className="ui-chrome-preview__dpad-inner">
            <TextureCircle variant="dpad-button" size={36}>
              ↑
            </TextureCircle>
          </div>
        </NineSlicePanel>
        <div className="ui-chrome-preview__rings">
          <TextureCircle variant="action-ring" size={48}>
            A
          </TextureCircle>
          <TextureCircle variant="action-ring-pressed" size={48}>
            B
          </TextureCircle>
          <TextureCircle variant="action-ring-danger" size={48}>
            !
          </TextureCircle>
        </div>
      </div>
    </section>
  );
}