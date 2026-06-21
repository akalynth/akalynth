import { useMemo } from 'react';
import { MapCanvas } from './MapCanvas';
import { SpriteCatalog } from './SpriteCatalog';
import {
  fullWorldVisualLandmarksForMap,
  showcaseFrameOverrides,
  showcaseMapForZone,
  showcasePlayersForZone,
  showcaseSpriteOverrides,
  SHOWCASE_SPRITE_COUNT,
  type WorldShowcaseZone,
} from '../data/fullWorldShowcase';

const ZONE_LABEL: Record<WorldShowcaseZone, string> = {
  rookguard: 'Rookguard',
  'high-city': 'High City',
  atlas: 'Sprite atlas',
};

function asZone(raw: string | null): WorldShowcaseZone {
  if (raw === 'rookguard' || raw === 'high-city' || raw === 'atlas') return raw;
  return 'high-city';
}

function zoneHref(zone: WorldShowcaseZone): string {
  const url = new URL(window.location.href);
  url.searchParams.set('mode', 'world');
  url.searchParams.set('zone', zone);
  return `${url.pathname}${url.search}`;
}

export function WorldShowcase() {
  const params = new URLSearchParams(window.location.search);
  const zone = asZone(params.get('zone'));
  const nowMs = 1_000;

  const mapView = useMemo(() => {
    if (zone === 'atlas') return null;
    const map = showcaseMapForZone(zone);
    const players = showcasePlayersForZone(zone);
    const allPlayers = [players.me, ...players.others];
    return {
      map,
      ...players,
      worldVisualObjects: fullWorldVisualLandmarksForMap(map.name),
      characterSpriteOverrides: showcaseSpriteOverrides(allPlayers),
      characterFrameOverrides: showcaseFrameOverrides(allPlayers),
    };
  }, [zone]);

  return (
    <div className="app-shell world-showcase">
      <header className="world-showcase__top">
        <div>
          <p className="world-showcase__eyebrow">Akalynth Classic 32 · display-only</p>
          <h1>Full world on web</h1>
          <p className="world-showcase__lede">
            Live map composition using <code>data/assets-src/sprites/</code> — {SHOWCASE_SPRITE_COUNT} character
            presets, {zone === 'atlas' ? '81' : '45+'} world overlays, swamp gallery, and canonical ground tiles.
          </p>
        </div>
        <nav className="world-showcase__nav" aria-label="World zones">
          {(Object.keys(ZONE_LABEL) as WorldShowcaseZone[]).map((entry) => (
            <a
              key={entry}
              href={zoneHref(entry)}
              className={entry === zone ? 'is-active' : undefined}
              aria-current={entry === zone ? 'page' : undefined}
            >
              {ZONE_LABEL[entry]}
            </a>
          ))}
        </nav>
      </header>

      {zone === 'atlas' ? (
        <SpriteCatalog />
      ) : (
        mapView && (
          <main className="world-showcase__stage">
            <section className="world-showcase__map-panel">
              <MapCanvas
                map={mapView.map}
                me={mapView.me}
                others={mapView.others}
                viewMode="full-map"
                nowMs={nowMs}
                targetId={null}
                fx={[]}
                onSelectTarget={() => {}}
                worldVisualObjects={mapView.worldVisualObjects}
                characterSpriteOverrides={mapView.characterSpriteOverrides}
                characterFrameOverrides={mapView.characterFrameOverrides}
              />
            </section>
            <aside className="world-showcase__legend">
              <h2>{ZONE_LABEL[zone]}</h2>
              <ul>
                <li>Map: {mapView.map.width}×{mapView.map.height} tiles</li>
                <li>World overlays: {mapView.worldVisualObjects.length}</li>
                <li>NPC / creature presets on map: {mapView.others.length + 1}</li>
              </ul>
              <p>
                Visuals do not change walkability, spawns, economy, or receipts. Server map metadata and tile codes
                remain authoritative.
              </p>
            </aside>
          </main>
        )
      )}
    </div>
  );
}