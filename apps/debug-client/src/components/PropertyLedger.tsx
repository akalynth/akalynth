import type { PropertyPublic } from '@shared/protocol';

interface AuctionState {
  property_id: string;
  kind: string;
  current_high: number | null;
  high_bidder_name: string | null;
  min_next: number;
  scheduled_close: number | null;
}

interface PropertyLedgerProps {
  properties: PropertyPublic[];
  myName: string | null;
  gold: number;
  auctionStates: Map<string, AuctionState>;
  onBuy: (propertyId: string) => void;
  onList: (propertyId: string, price: number) => void;
  onUnlist: (propertyId: string) => void;
  onOpenAuction: (propertyId: string, minBid: number, minIncrement: number, durationSeconds: number) => void;
  onBid: (propertyId: string, amount: number) => void;
  onCancelAuction: (propertyId: string) => void;
  onViewLedger: (propertyId: string) => void;
}

export function PropertyLedger({
  properties,
  myName,
  gold,
  auctionStates,
  onBuy,
  onList,
  onUnlist,
  onOpenAuction,
  onBid,
  onCancelAuction,
  onViewLedger,
}: PropertyLedgerProps) {
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
          const auction = auctionStates.get(p.property_id) ?? null;
          const isAuctioning = p.status === 'auctioning' || !!auction;

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
                : isAuctioning && auction?.current_high != null
                  ? `Bid: ${auction.current_high}g`
                  : '—';
          const statusClass =
            isAuctioning
              ? 'auctioning'
              : p.status === 'listed'
                ? 'for-sale'
                : p.status === 'owned'
                  ? 'owned'
                  : 'available';

          return (
            <li key={p.property_id} className={`property-ledger-row ${statusClass}`}>
              <div className="property-ledger-row-main">
                <span className="property-house">House {p.plot_id}</span>
                <span className="property-district">{p.district ?? p.zone}</span>
              </div>
              <div className="property-ledger-row-meta">
                <span className="property-owner">
                  {isAuctioning
                    ? `Auction (${auction?.kind ?? '?'})`
                    : p.status === 'listed'
                      ? 'For Sale'
                      : `Owner: ${ownerLabel}`}
                </span>
                <span className="property-price">{priceLabel}</span>
                {isAuctioning && auction && (
                  <span className="property-auction-meta">
                    Next bid: {auction.min_next}g{auction.high_bidder_name ? ` · High: ${auction.high_bidder_name}` : ''}
                  </span>
                )}
                {p.provenance_receipt_hash && (
                  <span className="property-provenance">
                    Receipt: {p.provenance_receipt_hash.slice(0, 12)}…
                  </span>
                )}
                <span className="property-sales">Sales: {p.sale_count}</span>
              </div>
              <div className="property-ledger-row-actions">
                {/* Primary / resale buy */}
                {p.status === 'unowned' && !mine && !isAuctioning && (
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
                {/* Auction: bid */}
                {isAuctioning && !mine && (
                  <button
                    type="button"
                    disabled={gold < (auction?.min_next ?? 1)}
                    onClick={() => {
                      const minBid = auction?.min_next ?? 1;
                      const raw = window.prompt(`Place bid (min ${minBid}g):`, String(minBid));
                      const amount = raw ? parseInt(raw, 10) : NaN;
                      if (Number.isInteger(amount) && amount >= minBid) onBid(p.property_id, amount);
                    }}
                  >
                    Bid
                  </button>
                )}
                {/* Owner: list */}
                {mine && p.status === 'owned' && (
                  <button
                    type="button"
                    onClick={() => {
                      const raw = window.prompt('List price (gold):', String(p.primary_price_gold));
                      const price = raw ? parseInt(raw, 10) : NaN;
                      if (Number.isInteger(price) && price > 0) onList(p.property_id, price);
                    }}
                  >
                    List
                  </button>
                )}
                {/* Owner: unlist */}
                {mine && p.status === 'listed' && (
                  <button type="button" onClick={() => onUnlist(p.property_id)}>
                    Unlist
                  </button>
                )}
                {/* Owner: open auction */}
                {mine && (p.status === 'owned' || p.status === 'listed') && (
                  <button
                    type="button"
                    onClick={() => {
                      const rawBid = window.prompt('Minimum bid (gold):', '1');
                      const minBid = rawBid ? parseInt(rawBid, 10) : NaN;
                      if (!Number.isInteger(minBid) || minBid <= 0) return;
                      const rawInc = window.prompt('Min increment (gold):', '1');
                      const minInc = rawInc ? parseInt(rawInc, 10) : NaN;
                      if (!Number.isInteger(minInc) || minInc <= 0) return;
                      onOpenAuction(p.property_id, minBid, minInc, 3600);
                    }}
                  >
                    Auction
                  </button>
                )}
                {/* Owner: cancel auction (zero bids only) */}
                {mine && isAuctioning && auction?.current_high == null && (
                  <button type="button" onClick={() => onCancelAuction(p.property_id)}>
                    Cancel auction
                  </button>
                )}
                {/* Anyone: view ownership history */}
                <button
                  type="button"
                  className="property-ledger-btn"
                  onClick={() => onViewLedger(p.property_id)}
                >
                  History
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
