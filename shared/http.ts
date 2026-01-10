// shared/http.ts
// HTTP Control Plane contract (API-first). Keep stable.

import type { PlayerPublic, PlayerStatus } from './types.js';

export type MapName = 'Rookguard' | 'Azura';

export interface HealthResponse {
  ok: true;
  version: string;
  tick_ms: number;
  now_iso: string;
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
  timestamp: string;
  evidence_hash: string;
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
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
