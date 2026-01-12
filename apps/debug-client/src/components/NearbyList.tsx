import type { PlayerPublic } from '@shared/types';

interface NearbyListProps {
  players: PlayerPublic[];
}

export function NearbyList({ players }: NearbyListProps) {
  if (players.length === 0) return null;
  return (
    <div className="nearby-card">
      <div className="nearby-title">Nearby (read-only)</div>
      <div className="nearby-list">
        {players.map((p) => (
          <div key={p.id} className="nearby-row" aria-label={`player-${p.name}`}>
            <span className={`hostility-dot ${p.status === 'dead' ? 'dead' : 'neutral'}`} />
            <span className="nearby-name">{p.name}</span>
            <span className="nearby-status">{p.status === 'dead' ? 'dead' : 'alive'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
