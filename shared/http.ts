// shared/http.ts
// HTTP Control Plane contract (API-first). Keep stable.

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
