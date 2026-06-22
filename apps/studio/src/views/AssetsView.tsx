import { TILE_VISUALS } from '../data/tileVisuals';

export function AssetsView() {
  return (
    <div className="studio-assets">
      <h1>Asset Spec</h1>
      <p className="studio-lead">rookguard.set · Classic 32 — top-down, tile-based, server-metadata locked.</p>
      <div className="studio-assets-grid">
        <section className="studio-card studio-card--wide">
          <h2>Grid &amp; resolution</h2>
          <ul className="studio-spec-list">
            <li>base tile <strong>32 × 32 px</strong></li>
            <li>display <strong>34 px</strong> (Studio Build view)</li>
            <li>map authority <strong>packages/shared/maps/rookguard.json</strong></li>
            <li>origin <strong>top-left, y-down</strong></li>
          </ul>
        </section>
        <section className="studio-card">
          <h2>Terrain tileset</h2>
          <div className="studio-swatch-row">
            {TILE_VISUALS.map((t) => (
              <div key={t.code} className="studio-swatch">
                <span style={{ background: t.color }} />
                <em>{t.label}</em>
                <code>{t.code}</code>
              </div>
            ))}
          </div>
        </section>
        <section className="studio-card">
          <h2>Builder kit objects</h2>
          <p className="studio-muted">From codex rookguard-builder-draft manifest: signs, runestone, lectern, spawn anchor.</p>
        </section>
      </div>
    </div>
  );
}