// Akalynth Property Registry v0 (House Ownership)
// In-memory projection — source of truth is receipts.
// Durable mirror lives in SQLite (properties table); both rebuild from replay.
// No timestamp/RNG reliance: replay order determines truth.

import type {
  AuditReceipt,
  HousePlot,
  PropertyAuctionKind,
  PropertyStatus,
} from '../../../../packages/shared/types.js';
import {
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_UNLISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
  PROPERTY_AUCTION_OPENED_ACTION,
  PROPERTY_BID_ACTION,
  PROPERTY_BID_REFUNDED_ACTION,
  PROPERTY_AUCTION_SETTLED_ACTION,
  PROPERTY_AUCTION_CANCELLED_ACTION,
  MAX_GOLD_AMOUNT,
} from '../../../../packages/shared/types.js';

// ============================================================================
// Types
// ============================================================================

export interface OwnerHistoryEntry {
  from: string | null; // previous owner player id (null = treasury / primary sale)
  to: string;          // new owner player id
  price: number;
  action: 'purchased' | 'transferred';
  timestamp: string;   // ISO8601 (receipt timestamp)
}

export interface PropertyProjection {
  property_id: string; // `${zone}:${plot_id}`
  zone: string;
  plot_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  district: string | null;
  owner_player_id: string | null; // null = unowned / treasury-held
  status: PropertyStatus;
  listed_price_gold: number | null;
  primary_price_gold: number;
  purchased_at: string | null;
  sale_count: number;
  owner_history: OwnerHistoryEntry[];
  genesis_receipt: string;
  last_receipt: string;
}

// Auction projection (Property Auction Lane — projection/reducer only).
// In-memory, receipt-derived; ONE auction per property at a time. No wallet,
// escrow, persistence, or wall-clock state lives here. Settlement truth comes
// from the property_auction_settled receipt, never from a clock.
export interface AuctionProjection {
  property_id: string;
  kind: PropertyAuctionKind;        // 'primary' (unowned→winner, sink) | 'resale'
  seller_id: string | null;         // null for primary; owner id for resale
  min_bid: number;
  min_increment_gold: number;
  current_high: number | null;      // null = no accepted bid yet
  high_bidder_id: string | null;
  status: 'open' | 'settled' | 'cancelled';
  // RECEIPT METADATA ONLY: absolute close time recorded by the live open handler
  // into the property_auction_opened receipt. The reducer STORES it but MUST NOT
  // compare it to Date.now() or decide settlement from it — settlement truth is
  // the property_auction_settled receipt. The close→settle loop (clock-injected)
  // reads this to decide WHEN to emit settlement.
  scheduled_close_ms: number | null;
  opened_receipt: string;
  last_receipt: string;
}

export type WriteReceiptFn = (
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
) => void;

// ============================================================================
// In-Memory Projection (receipt-derived)
// ============================================================================

const propertyById = new Map<string, PropertyProjection>();
// One auction projection per property (open/settled/cancelled). Receipt-derived.
const auctionByPropertyId = new Map<string, AuctionProjection>();
// Tracks plots we have already emitted a property_created receipt for this
// process, so boot-time seeding is idempotent even before the receipt is read
// back through the reducer.
const seededProperties = new Set<string>();

export function makePropertyId(zone: string, plotId: string): string {
  return `${zone}:${plotId}`;
}

export function getProperty(propertyId: string): PropertyProjection | null {
  return propertyById.get(propertyId) ?? null;
}

export function getAllProperties(): PropertyProjection[] {
  return [...propertyById.values()];
}

export function getPropertiesForOwner(playerId: string): PropertyProjection[] {
  return [...propertyById.values()].filter((p) => p.owner_player_id === playerId);
}

/** Market view: anything a player could act on — listed (resale) or unowned (primary). */
export function getMarketListings(): PropertyProjection[] {
  return [...propertyById.values()].filter((p) => p.status === 'listed' || p.status === 'unowned');
}

export function isOwnedBy(propertyId: string, playerId: string): boolean {
  return propertyById.get(propertyId)?.owner_player_id === playerId;
}

export function getAuction(propertyId: string): AuctionProjection | null {
  return auctionByPropertyId.get(propertyId) ?? null;
}

export function getOpenAuctions(): AuctionProjection[] {
  return [...auctionByPropertyId.values()].filter((a) => a.status === 'open');
}

/** Minimum acceptable next bid for an auction (first bid: min_bid). */
export function minNextBid(auction: AuctionProjection): number {
  return auction.current_high === null
    ? auction.min_bid
    : auction.current_high + auction.min_increment_gold;
}

/** Clear all projection state (testing / fresh replay). */
export function clearPropertyProjection(): void {
  propertyById.clear();
  auctionByPropertyId.clear();
  seededProperties.clear();
}

/**
 * Hydrate a single projection entry from a persisted row.
 * Called at warm boot BEFORE seeding so existing plots are not re-emitted.
 */
export function hydrateProperty(p: PropertyProjection): void {
  propertyById.set(p.property_id, p);
}

// ============================================================================
// Seeding (idempotent, receipt-sourced)
// ============================================================================

/**
 * Emit a `property_created` receipt for each map house plot that does not yet
 * exist in the projection. Idempotent: skips plots already hydrated from DB or
 * already seeded this process. The reducer is what actually creates the entry.
 */
export function ensurePropertiesSeeded(
  housePlots: HousePlot[],
  zone: string,
  writeReceipt: WriteReceiptFn
): void {
  for (const plot of housePlots) {
    const propertyId = makePropertyId(zone, plot.id);
    if (propertyById.has(propertyId) || seededProperties.has(propertyId)) continue;

    seededProperties.add(propertyId);
    writeReceipt({
      actor_id: 'system',
      action: PROPERTY_CREATED_ACTION,
      inputs: {
        property_id: propertyId,
        zone,
        plot_id: plot.id,
        x: plot.x,
        y: plot.y,
        width: plot.width,
        height: plot.height,
        district: plot.district ?? null,
        primary_price_gold: plot.primary_price_gold ?? 0,
      },
      result: 'ok',
    });
  }
}

// ============================================================================
// Validation
// ============================================================================

export function isValidPrice(price: unknown): price is number {
  return (
    typeof price === 'number' &&
    Number.isInteger(price) &&
    price > 0 &&
    price <= MAX_GOLD_AMOUNT
  );
}

// ============================================================================
// Receipt Reducer (Deterministic)
// ============================================================================

/**
 * Receipt reducer — call during replay loop and on new receipt write.
 * Reads ONLY from receipt.inputs. Guards impossible transitions (does not
 * apply silently — logs, mirroring the treasury reducer).
 */
export function applyReceiptToProperty(receipt: AuditReceipt): void {
  const actorId = receipt.actor_id;
  const eventHash = receipt.event_hash;

  switch (receipt.action) {
    case PROPERTY_CREATED_ACTION: {
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      // Idempotent: created is one-shot per property.
      if (propertyById.has(propertyId)) break;

      const zone = receipt.inputs?.zone as string | undefined;
      const plotId = receipt.inputs?.plot_id as string | undefined;
      if (!zone || !plotId) break;

      const primaryPrice = receipt.inputs?.primary_price_gold;
      propertyById.set(propertyId, {
        property_id: propertyId,
        zone,
        plot_id: plotId,
        x: Number(receipt.inputs?.x ?? 0),
        y: Number(receipt.inputs?.y ?? 0),
        width: Number(receipt.inputs?.width ?? 0),
        height: Number(receipt.inputs?.height ?? 0),
        district: (receipt.inputs?.district as string | null) ?? null,
        owner_player_id: null,
        status: 'unowned',
        listed_price_gold: null,
        primary_price_gold: typeof primaryPrice === 'number' ? primaryPrice : 0,
        purchased_at: null,
        sale_count: 0,
        owner_history: [],
        genesis_receipt: eventHash,
        last_receipt: eventHash,
      });
      break;
    }

    case PROPERTY_LISTED_ACTION: {
      const propertyId = receipt.inputs?.property_id as string | undefined;
      const price = receipt.inputs?.price;
      if (!propertyId) break;
      const prop = propertyById.get(propertyId);
      if (!prop) break;
      if (prop.owner_player_id !== actorId) {
        console.warn(`[property] INVALID list: actor=${actorId} not owner of ${propertyId}`);
        break;
      }
      if (!isValidPrice(price)) break;
      prop.status = 'listed';
      prop.listed_price_gold = price;
      prop.last_receipt = eventHash;
      break;
    }

    case PROPERTY_UNLISTED_ACTION: {
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      const prop = propertyById.get(propertyId);
      if (!prop) break;
      if (prop.owner_player_id !== actorId) {
        console.warn(`[property] INVALID unlist: actor=${actorId} not owner of ${propertyId}`);
        break;
      }
      prop.status = 'owned';
      prop.listed_price_gold = null;
      prop.last_receipt = eventHash;
      break;
    }

    case PROPERTY_PURCHASED_ACTION: {
      // Primary sale: treasury (unowned) → buyer.
      const propertyId = receipt.inputs?.property_id as string | undefined;
      const price = receipt.inputs?.price;
      if (!propertyId || !actorId) break;
      const prop = propertyById.get(propertyId);
      if (!prop) break;
      if (prop.status !== 'unowned' || prop.owner_player_id !== null) {
        console.warn(`[property] INVALID primary purchase: ${propertyId} not unowned`);
        break;
      }
      prop.owner_player_id = actorId;
      prop.status = 'owned';
      prop.listed_price_gold = null;
      prop.purchased_at = receipt.timestamp;
      prop.sale_count += 1;
      prop.owner_history.push({
        from: null,
        to: actorId,
        price: typeof price === 'number' ? price : prop.primary_price_gold,
        action: 'purchased',
        timestamp: receipt.timestamp,
      });
      prop.last_receipt = eventHash;
      break;
    }

    case PROPERTY_TRANSFERRED_ACTION: {
      // Resale: seller → buyer (actor_id = buyer).
      const propertyId = receipt.inputs?.property_id as string | undefined;
      const sellerId = receipt.inputs?.seller_id as string | undefined;
      const price = receipt.inputs?.price;
      if (!propertyId || !actorId || !sellerId) break;
      const prop = propertyById.get(propertyId);
      if (!prop) break;
      if (prop.owner_player_id !== sellerId) {
        console.warn(`[property] INVALID transfer: ${propertyId} not owned by seller ${sellerId}`);
        break;
      }
      prop.owner_player_id = actorId;
      prop.status = 'owned';
      prop.listed_price_gold = null;
      prop.purchased_at = receipt.timestamp;
      prop.sale_count += 1;
      prop.owner_history.push({
        from: sellerId,
        to: actorId,
        price: typeof price === 'number' ? price : 0,
        action: 'transferred',
        timestamp: receipt.timestamp,
      });
      prop.last_receipt = eventHash;
      break;
    }

    // ========================================================================
    // Property Auctions (projection/reducer only — NO wallet/escrow/persistence/
    // handlers, NO wall-clock). Settlement truth comes from the settle receipt's
    // inputs, applied in sequence — never recomputed from a clock.
    // ========================================================================

    case PROPERTY_AUCTION_OPENED_ACTION: {
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      const prop = propertyById.get(propertyId);
      if (!prop) break;
      const existing = auctionByPropertyId.get(propertyId);
      if (existing && existing.status === 'open') {
        console.warn(`[property] INVALID auction_open: ${propertyId} already auctioning`);
        break;
      }
      const kind = receipt.inputs?.kind as PropertyAuctionKind | undefined;
      if (kind !== 'primary' && kind !== 'resale') break;
      if (kind === 'primary') {
        if (prop.status !== 'unowned' || prop.owner_player_id !== null) {
          console.warn(`[property] INVALID primary auction_open: ${propertyId} not unowned`);
          break;
        }
      } else {
        // Resale: only the current owner may open; status must be 'owned'.
        if (prop.owner_player_id !== actorId) {
          console.warn(`[property] INVALID resale auction_open: actor=${actorId} not owner of ${propertyId}`);
          break;
        }
        if (prop.status !== 'owned') {
          console.warn(`[property] INVALID resale auction_open: ${propertyId} status=${prop.status}`);
          break;
        }
      }
      const minBid = receipt.inputs?.min_bid;
      const minIncrement = receipt.inputs?.min_increment_gold;
      if (!isValidPrice(minBid) || !isValidPrice(minIncrement)) break;
      prop.status = 'auctioning';
      prop.listed_price_gold = null;
      prop.last_receipt = eventHash;
      auctionByPropertyId.set(propertyId, {
        property_id: propertyId,
        kind,
        seller_id: kind === 'resale' ? actorId : null,
        min_bid: minBid,
        min_increment_gold: minIncrement,
        current_high: null,
        high_bidder_id: null,
        status: 'open',
        // Stored metadata only (recorded by the live handler); never used by the
        // reducer to decide settlement.
        scheduled_close_ms:
          typeof receipt.inputs?.scheduled_close_ms === 'number'
            ? (receipt.inputs.scheduled_close_ms as number)
            : null,
        opened_receipt: eventHash,
        last_receipt: eventHash,
      });
      break;
    }

    case PROPERTY_BID_ACTION: {
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId || !actorId) break;
      const auction = auctionByPropertyId.get(propertyId);
      if (!auction || auction.status !== 'open') {
        console.warn(`[property] INVALID bid: no open auction for ${propertyId}`);
        break;
      }
      // Resale seller cannot bid on their own auction.
      if (auction.kind === 'resale' && auction.seller_id === actorId) {
        console.warn(`[property] INVALID bid: seller ${actorId} cannot bid on own auction ${propertyId}`);
        break;
      }
      const amount = receipt.inputs?.amount;
      if (!isValidPrice(amount)) break;
      if (amount < minNextBid(auction)) {
        console.warn(`[property] INVALID bid: ${amount} < min_next ${minNextBid(auction)} for ${propertyId}`);
        break;
      }
      auction.current_high = amount;
      auction.high_bidder_id = actorId;
      auction.last_receipt = eventHash;
      break;
    }

    case PROPERTY_BID_REFUNDED_ACTION: {
      // Marker that a prior high bidder was refunded. The gold movement is a
      // treasury (wallet_credit) concern handled elsewhere; the auction high
      // state already reflects the outbidding bid. Projection: record only.
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      const auction = auctionByPropertyId.get(propertyId);
      if (!auction) break;
      auction.last_receipt = eventHash;
      break;
    }

    case PROPERTY_AUCTION_SETTLED_ACTION: {
      // Receipt-sourced: winner/price/seller come from inputs, applied in
      // sequence. No clock, no recomputation of the winner.
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      const prop = propertyById.get(propertyId);
      const auction = auctionByPropertyId.get(propertyId);
      if (!prop || !auction || auction.status !== 'open') {
        console.warn(`[property] INVALID settle: no open auction for ${propertyId}`);
        break;
      }
      const winnerId = (receipt.inputs?.winner_id as string | null | undefined) ?? null;
      if (winnerId) {
        const price = receipt.inputs?.price;
        const sellerId =
          (receipt.inputs?.seller_id as string | null | undefined) ?? auction.seller_id;
        prop.owner_player_id = winnerId;
        prop.status = 'owned';
        prop.listed_price_gold = null;
        prop.purchased_at = receipt.timestamp;
        prop.sale_count += 1;
        prop.owner_history.push({
          from: auction.kind === 'primary' ? null : sellerId,
          to: winnerId,
          price: typeof price === 'number' ? price : 0,
          action: auction.kind === 'primary' ? 'purchased' : 'transferred',
          timestamp: receipt.timestamp,
        });
        prop.last_receipt = eventHash;
      } else {
        // No bids: revert to pre-auction status.
        prop.status = auction.kind === 'primary' ? 'unowned' : 'owned';
        prop.last_receipt = eventHash;
      }
      auction.status = 'settled';
      auction.last_receipt = eventHash;
      break;
    }

    case PROPERTY_AUCTION_CANCELLED_ACTION: {
      // Owner cancels a resale auction — only while it has zero bids (D4).
      const propertyId = receipt.inputs?.property_id as string | undefined;
      if (!propertyId) break;
      const prop = propertyById.get(propertyId);
      const auction = auctionByPropertyId.get(propertyId);
      if (!prop || !auction || auction.status !== 'open') break;
      if (auction.seller_id !== actorId) {
        console.warn(`[property] INVALID auction_cancel: actor=${actorId} not seller of ${propertyId}`);
        break;
      }
      if (auction.current_high !== null) {
        console.warn(`[property] INVALID auction_cancel: ${propertyId} has bids`);
        break;
      }
      prop.status = 'owned';
      prop.last_receipt = eventHash;
      auction.status = 'cancelled';
      auction.last_receipt = eventHash;
      break;
    }

    default:
      break;
  }
}
