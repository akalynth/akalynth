// packages/shared/http.ts
// HTTP Control Plane contract (API-first). Keep stable.

import type {
  LearningFeatureRow,
  PlayerPublic,
  PlayerStatus,
  PropertyStatus,
  SuspicionBand,
  SuspicionScore,
  SuspicionTopSignal,
} from './types.js';

export type MapName = 'Rookguard' | 'Azura';
export type MapWireName = MapName | 'HighCity';

export function normalizeMapName(value: string): MapName | null {
  if (value === 'Rookguard') return 'Rookguard';
  if (value === 'Azura' || value === 'HighCity') return 'Azura';
  return null;
}

export function isAcceptedMapName(value: string): value is MapWireName {
  return normalizeMapName(value) !== null;
}

export function displayMapName(value: string): string {
  if (value === 'Azura' || value === 'HighCity') return 'High City';
  if (value === 'Rookguard') return 'Rookguard';
  return value;
}

export interface HealthResponse {
  ok: true;
  version: string;
  tick_ms: number;
  now_iso: string;
  /** Git commit (full SHA) of the built tree; 'unknown' for non-git builds. Additive (#145). */
  commit?: string;
  /** ISO 8601 build timestamp; 'unknown' if not a built tree. Additive (#145). */
  built_at?: string;
}

export interface MapsListResponse {
  maps: Array<{ name: MapName; width: number; height: number }>;
}

export interface MapDetailResponse {
  name: MapName;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  landmarks?: unknown;
}

export interface GuestSessionResponse {
  player_id: string;
  guest_token: string;
  name: string;
}

export interface SessionMeResponse {
  ok: true;
  player_id: string;
  guest_token: string;
  name: string;
  minted_at_ms: number;
  expires_at_ms: number;
  ttl_ms_remaining: number;
}

export interface HttpErrorResponse {
  error: string;
}

export interface WorldPlayersResponse {
  players: PlayerPublic[];
}

export interface WorldPlayersQuery {
  limit?: number;
}

export interface WorldStateResponse {
  ok: true;
  version: string;
  tick_ms: number;
  updated_at_ms: number;
  map: {
    name: MapName;
    width: number;
    height: number;
    spawn: { x: number; y: number };
  };
  player_count: number;
  me?: {
    player_id: string;
    name: string;
    guest_token: string;
    minted_at_ms: number;
    expires_at_ms: number;
    ttl_ms_remaining: number;
    status?: PlayerStatus;
    dead_until_ms?: number | null;
    dead_ttl_ms?: number | null;
  };
}

export type WorldStateResult = WorldStateResponse | { error: string; status: number };

// ============================================================================
// Receipts API
// ============================================================================

export interface Receipt {
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  actor_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  inputs_hash: string;
  outputs_hash: string;
}

export interface ReceiptsQueryParams {
  player_id?: string;
  action?: string;
  since?: string; // ISO timestamp
  until?: string; // ISO timestamp
  limit?: number; // default 100, max 1000
  offset?: number;
}

export interface ReceiptsResponse {
  receipts: Receipt[];
  total: number;
  has_more: boolean;
}

// Public receipts (delayed, filtered, redacted by default; action-specific visibility)
export type PublicReceiptsActorMode = 'anon' | 'daily_hash';

export interface PublicReceipt {
  sequence: number;
  timestamp: string;
  prev_hash: string;
  event_hash: string;
  signature: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string | null;
  inputs_hash: string;
  outputs_hash: string;
  actor_id: string;
}

export interface PublicReceiptsQueryParams {
  action?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface PublicReceiptsResponse {
  mode: 'strict';
  receipts: PublicReceipt[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// Rumors API (public)
// ============================================================================

export interface PublicRumor {
  rumor_id: string;
  text: string;
  map: MapName;
  actor: string;
  timestamp: string;
}

export type PublicRumorsQueryParams = PublicReceiptsQueryParams;

export interface PublicRumorsResponse {
  rumors: PublicRumor[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// Property Market API (public, anonymized)
// ============================================================================

export interface PropertyMarketListing {
  property_id: string;
  zone: string;
  plot_id: string;
  district: string | null;
  status: PropertyStatus;
  owner_name: string | null; // anonymized display name; never a raw player id
  primary_price_gold: number;
  listed_price_gold: number | null;
}

export interface PropertyMarketResponse {
  listings: PropertyMarketListing[];
  total: number;
}

export interface PropertyLedgerEntry {
  from_name: string | null;
  to_name: string;
  price: number;
  action: 'purchased' | 'transferred';
  timestamp: string;
}

export interface PropertyLedgerResponse {
  property_id: string;
  district: string | null;
  owner_name: string | null;
  sale_count: number;
  owner_count: number; // distinct owners over the property's history
  last_sale: { from_name: string | null; to_name: string; price: number; timestamp: string } | null;
  owner_history: PropertyLedgerEntry[];
}

// ============================================================================
// Transparency API (public)
// ============================================================================

export interface TransparencyResponse {
  version: string;
  server_version: string;
  identity: {
    auth_public_key_hex: string;
    key_derivation: string;
    // Raw-seed Ed25519 public key that signs receipts AND chronicle events
    // (distinct from auth_public_key_hex, the blake3-derived token key). Published
    // so a third party can verify receipt + chronicle-line signatures offline
    // (e.g. RNG outcome `verified`). See docs/RNG_OUTCOME_VERIFICATION.md.
    signing_public_key_hex: string;
    signing_key_derivation: string;
  };
  principles: string[];
  documentation: {
    monetization_constitution: string;
    architecture: string;
    anticheat: string;
  };
  public_receipts_endpoint: string;
  verification: {
    chain_integrity: string;
    monetization_policy: string;
    work_contracts: string;
  };
}

// ============================================================================
// Anti-Cheat Priors API (debug/operator)
// ============================================================================

export interface AntiCheatPriorRecord {
  player_id: string;
  session_id: string;
  score: number;
  band: SuspicionBand;
  top_signals: SuspicionTopSignal[];
  feature_version: string;
  model_version: string;
  computed_at: string;
  first_sequence: number;
  last_sequence: number;
  receipt_count: number;
}

export interface AntiCheatPriorResponse {
  prior: AntiCheatPriorRecord;
}

export type AntiCheatPriorImportRecord = SuspicionScore;
export type AntiCheatFeatureImportRecord = LearningFeatureRow;
