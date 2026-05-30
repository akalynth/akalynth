// Akalynth Property Registry v0 (House Ownership)
// In-memory projection — source of truth is receipts.
// Durable mirror lives in SQLite (properties table); both rebuild from replay.
// No timestamp/RNG reliance: replay order determines truth.

import type {
  AuditReceipt,
  HousePlot,
  PropertyStatus,
} from '../../../../packages/shared/types.js';
import {
  PROPERTY_CREATED_ACTION,
  PROPERTY_LISTED_ACTION,
  PROPERTY_UNLISTED_ACTION,
  PROPERTY_PURCHASED_ACTION,
  PROPERTY_TRANSFERRED_ACTION,
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

type WriteReceiptFn = (
  receipt: Omit<
    AuditReceipt,
    'sequence' | 'timestamp' | 'prev_hash' | 'event_hash' | 'signature' | 'inputs_hash' | 'outputs_hash'
  >
) => void;

// ============================================================================
// In-Memory Projection (receipt-derived)
// ============================================================================

const propertyById = new Map<string, PropertyProjection>();
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

/** Clear all projection state (testing / fresh replay). */
export function clearPropertyProjection(): void {
  propertyById.clear();
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

    default:
      break;
  }
}
