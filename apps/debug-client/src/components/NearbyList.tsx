import type { PlayerPublic } from '@shared/types';

interface NearbyListProps {
  me: PlayerPublic | null;
  players: PlayerPublic[];
  onInspect: (playerId: string) => void;
}

function contactLabel(me: PlayerPublic | null, player: PlayerPublic): string {
  if (!me) return player.status === 'dead' ? 'dead' : 'visible';
  const distance = Math.abs(me.x - player.x) + Math.abs(me.y - player.y);
  if (player.status === 'dead') return `dead · ${distance} tile${distance === 1 ? '' : 's'}`;
  if (distance <= 1) return 'contact range';
  return `${distance} tile${distance === 1 ? '' : 's'}`;
}

export function NearbyList({ me, players, onInspect }: NearbyListProps) {
  if (players.length === 0) return null;
  return (
    <div className="nearby-card">
      <div className="nearby-title">Nearby players</div>
      <div className="nearby-list">
        {players.map((p) => (
          <div key={p.id} className="nearby-row" aria-label={`player-${p.name}`}>
            <span className={`hostility-dot ${p.status === 'dead' ? 'dead' : 'neutral'}`} />
            <span className="nearby-name">{p.name}</span>
            <span className="nearby-status">{contactLabel(me, p)}</span>
            <button
              type="button"
              className="nearby-inspect-btn"
              onClick={() => onInspect(p.id)}
              aria-label={`Inspect ${p.name}`}
            >
              Inspect
            </button>
          </div>
        ))}
      </div>
      <div className="nearby-status">Combat and trade intents stay server-authoritative.</div>
    </div>
  );
}
