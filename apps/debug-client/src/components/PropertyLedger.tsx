import type { PropertyPublic } from '@shared/protocol';

interface PropertyLedgerProps {
  properties: PropertyPublic[];
  myName: string | null;
  gold: number;
  onBuy: (propertyId: string) => void;
  onList: (propertyId: string, price: number) => void;
  onUnlist: (propertyId: string) => void;
}

// "Property Ledger" panel — the in-game view of who owns what.
// Drives screenshot 1 (Ledger). Pure/presentational: all data via props.
export function PropertyLedger({ properties, myName, gold, onBuy, onList, onUnlist }: PropertyLedgerProps) {
  if (properties.length === 0) return null;

  const sorted = [...properties].sort((a, b) => a.plot_id.localeCompare(b.plot_id));
  const soldCount = properties.reduce((n, p) => n + p.sale_count, 0);

  return (
    <div className="property-ledger">
      <div className="property-ledger-header">
        <span>Property Ledger</span>
        <span className="property-ledger-stat">Sold: {soldCount}</span>
      </div>
      <ul className="property-ledger-list">
        {sorted.map((p) => {
          const mine = !!myName && p.owner_name === myName;
          const ownerLabel =
            p.status === 'unowned'
              ? 'Available'
              : mine
                ? 'You'
                : (p.owner_name ?? 'Owned');
          const priceLabel =
            p.status === 'listed' && p.listed_price_gold != null
              ? `${p.listed_price_gold}g`
              : p.status === 'unowned'
                ? `${p.primary_price_gold}g`
                : '—';
          const statusClass =
            p.status === 'listed' ? 'for-sale' : p.status === 'owned' ? 'owned' : 'available';
          return (
            <li key={p.property_id} className={`property-ledger-row ${statusClass}`}>
              <div className="property-ledger-row-main">
                <span className="property-house">House {p.plot_id}</span>
                <span className="property-district">{p.district ?? p.zone}</span>
              </div>
              <div className="property-ledger-row-meta">
                <span className="property-owner">
                  {p.status === 'listed' ? 'For Sale' : `Owner: ${ownerLabel}`}
                </span>
                <span className="property-price">{priceLabel}</span>
                <span className="property-sales">Sales: {p.sale_count}</span>
              </div>
              <div className="property-ledger-row-actions">
                {p.status === 'unowned' && !mine && (
                  <button
                    type="button"
                    disabled={gold < p.primary_price_gold}
                    onClick={() => onBuy(p.property_id)}
                  >
                    Buy {p.primary_price_gold}g
                  </button>
                )}
                {p.status === 'listed' && !mine && p.listed_price_gold != null && (
                  <button
                    type="button"
                    disabled={gold < p.listed_price_gold}
                    onClick={() => onBuy(p.property_id)}
                  >
                    Buy {p.listed_price_gold}g
                  </button>
                )}
                {mine && p.status === 'owned' && (
                  <button
                    type="button"
                    onClick={() => {
                      const raw = window.prompt('List price (gold):', String(p.primary_price_gold));
                      const price = raw ? parseInt(raw, 10) : NaN;
                      if (Number.isInteger(price) && price > 0) onList(p.property_id, price);
                    }}
                  >
                    List for sale
                  </button>
                )}
                {mine && p.status === 'listed' && (
                  <button type="button" onClick={() => onUnlist(p.property_id)}>
                    Unlist
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
