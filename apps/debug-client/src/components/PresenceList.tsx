import type { PlayerPublic } from '@shared/types';

interface PresenceListProps {
  me: PlayerPublic | null;
  others: PlayerPublic[];
}

export function PresenceList({ me, others }: PresenceListProps) {
  return (
    <div className="presence-list">
      <div className="presence-list__header">
        Present ({1 + others.length})
      </div>
      <div className="presence-list__body">
        {me && (
          <div className="presence-list__row presence-list__row--me">
            <span className="presence-list__dot" />
            <span className="presence-list__name">{me.name} (you)</span>
            <span className="presence-list__pos">{me.x},{me.y}</span>
          </div>
        )}
        {others.map((p) => (
          <div key={p.id} className="presence-list__row">
            <span className={`presence-list__dot ${p.status === 'dead' ? 'presence-list__dot--dead' : ''}`} />
            <span className="presence-list__name">{p.name}</span>
            <span className="presence-list__pos">{p.x},{p.y}</span>
          </div>
        ))}
        {!me && others.length === 0 && (
          <div className="presence-list__empty">Connecting...</div>
        )}
      </div>
    </div>
  );
}
