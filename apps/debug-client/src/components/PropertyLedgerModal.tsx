import type { PropertyOwnerHistoryEntry } from '@shared/protocol';

interface PropertyLedgerModalProps {
  ledger: { property_id: string; owner_history: PropertyOwnerHistoryEntry[]; sale_count: number };
  onClose: () => void;
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function PropertyLedgerModal({ ledger, onClose }: PropertyLedgerModalProps) {
  const { property_id, owner_history, sale_count } = ledger;

  return (
    <div className="property-ledger-overlay" role="dialog" aria-modal="true" aria-label="Property history">
      <div className="property-ledger-modal">
        <div className="property-ledger-modal__header">
          <strong>Ownership History — {property_id}</strong>
          <span className="property-ledger-modal__sales">Total sales: {sale_count}</span>
          <button type="button" onClick={onClose} aria-label="Close history">x</button>
        </div>
        <div className="property-ledger-modal__body">
          {owner_history.length === 0 && (
            <p className="property-ledger-empty">No recorded ownership changes.</p>
          )}
          {owner_history.length > 0 && (
            <ul className="property-ledger-history">
              {[...owner_history].reverse().map((entry, i) => (
                <li key={i} className="property-ledger-history-row">
                  <span className="history-action">{entry.action === 'purchased' ? 'Purchased' : 'Transferred'}</span>
                  <span className="history-parties">
                    {entry.from_name ? `${entry.from_name} → ` : ''}{entry.to_name}
                  </span>
                  <span className="history-price">{entry.price}g</span>
                  <span className="history-date">{formatDate(entry.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
