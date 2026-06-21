import { useMemo } from 'react';

type SpriteCatalogEntry = {
  path: string;
  url: string;
  category: string;
};

const spriteModules = import.meta.glob('../../../../data/assets-src/sprites/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function categoryFor(path: string): string {
  const normalized = path.replace(/^.*\/sprites\//, '');
  if (normalized.startsWith('world/')) return `world / ${normalized.split('/')[1] ?? 'misc'}`;
  if (normalized.startsWith('ui/')) return 'ui';
  if (normalized.startsWith('characters/')) return 'characters';
  if (normalized.startsWith('creatures/')) return 'creatures';
  if (normalized.includes('__')) return normalized.split('__')[0];
  return 'misc';
}

export function SpriteCatalog() {
  const entries = useMemo(() => {
    const rows: SpriteCatalogEntry[] = Object.entries(spriteModules).map(([modulePath, url]) => {
      const path = modulePath.replace(/^.*\/sprites\//, '');
      return { path, url, category: categoryFor(path) };
    });
    rows.sort((a, b) => a.category.localeCompare(b.category) || a.path.localeCompare(b.path));
    return rows;
  }, []);

  const categories = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.category));
    return Array.from(set).sort();
  }, [entries]);

  return (
    <div className="sprite-catalog">
      <header className="sprite-catalog__header">
        <h1>Akalynth sprite atlas</h1>
        <p>
          {entries.length} assets from <code>data/assets-src/sprites/</code>. Display-only catalog;
          collision and gameplay remain server-authoritative.
        </p>
      </header>
      {categories.map((category) => {
        const categoryEntries = entries.filter((entry) => entry.category === category);
        return (
          <section key={category} className="sprite-catalog__section">
            <h2>{category}</h2>
            <div className="sprite-catalog__grid">
              {categoryEntries.map((entry) => (
                <figure key={entry.path} className="sprite-catalog__card">
                  <img src={entry.url} alt={entry.path} loading="lazy" />
                  <figcaption>{entry.path}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}