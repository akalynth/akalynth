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

// ============================================================================
// Account Character API (account-gated create/select; public catalogs)
// ============================================================================

export type AccountCharacterWorldId = 'rookguard' | 'high_city';
export type AccountCharacterSex = 'male' | 'female';
export type AccountCharacterOutfitId =
  | 'male_wanderer'
  | 'male_guard'
  | 'male_mage'
  | 'female_wanderer'
  | 'female_guard'
  | 'female_mage';

export interface AccountCharacterWorldOption {
  world_id: AccountCharacterWorldId;
  name: string;
  description: string;
}

export interface AccountCharacterOutfitOption {
  outfit_id: AccountCharacterOutfitId;
  sex: AccountCharacterSex;
  name: string;
  /** null means the server has reserved the outfit id, but art is still pending. */
  sprite_id: string | null;
}

export interface AccountCharacterPublic {
  character_id: string;
  name: string;
  world_id: AccountCharacterWorldId;
  sex: AccountCharacterSex;
  outfit_id: AccountCharacterOutfitId;
  created_at?: string;
}

export interface AccountCharacterWorldsResponse {
  worlds: AccountCharacterWorldOption[];
}

export interface AccountCharacterOutfitsResponse {
  outfits: AccountCharacterOutfitOption[];
}

export interface AccountCharactersResponse {
  characters: AccountCharacterPublic[];
}

export interface AccountCharacterCreateRequest {
  name: string;
  world_id: AccountCharacterWorldId;
  sex: AccountCharacterSex;
  outfit_id: AccountCharacterOutfitId;
}

export interface AccountCharacterSelectRequest {
  character_id: string;
}

export interface AccountCharacterPlayResponse {
  ok: true;
  character: AccountCharacterPublic;
  token: string;
  expires_at: number;
}

// ============================================================================
// Identity Seal API (additive)
// ============================================================================

export type PrincipalStatus = 'active' | 'seal_retired' | 'principal_deleted' | 'disabled';
export type PrincipalIdentityLevel = 'guest' | 'key_bound' | 'pgp_pending' | 'pgp_bound';
export type PrincipalChallengePurpose =
  | 'principal_login'
  | 'principal_retire'
  | 'principal_delete'
  | 'pgp_bind'
  | 'forum_authority_post';
export type PrincipalCapability =
  | 'forum:post_basic'
  | 'forum:report'
  | 'forum:block'
  | 'forum:post_authority'
  | 'moderation:read'
  | 'moderation:resolve'
  | 'project:announce';

export interface PrincipalPublic {
  principal_id: string;
  handle: string;
  display_name: string;
  status: PrincipalStatus;
  identity_level: PrincipalIdentityLevel;
  roles: string[];
  capabilities: PrincipalCapability[];
  recovery_mode: 'none';
  created_at: string;
  seal_retired_at: string | null;
  principal_deleted_at: string | null;
}

export interface PrincipalRegisterRequest {
  handle: string;
  display_name?: string;
  public_key_spki_pem: string;
  accepted_terms: true;
  client: 'android' | 'web';
}

export interface PrincipalRegisterResponse {
  ok: true;
  principal: PrincipalPublic;
  key_fingerprint: string;
  loss_warning: string;
}

export interface PrincipalChallengeRequest {
  principal_id: string;
  purpose: PrincipalChallengePurpose;
  domain: 'akalynth.com';
  client: 'android' | 'web';
}

export interface PrincipalChallengePayload {
  type: 'akalynth.challenge.v1';
  domain: 'akalynth.com';
  purpose: PrincipalChallengePurpose;
  principal_id: string;
  challenge_id: string;
  nonce: string;
  issued_at: string;
  expires_at: string;
  client: 'android' | 'web';
  protocol_version: '1';
}

export interface PrincipalChallengeResponse {
  ok: true;
  challenge_id: string;
  payload: PrincipalChallengePayload;
  canonical_payload: string;
  expires_at: string;
}

export interface PrincipalVerifyRequest {
  principal_id: string;
  challenge_id: string;
  signature_base64url: string;
}

export interface PrincipalVerifyResponse {
  ok: true;
  principal: PrincipalPublic;
  session_token: string;
  expires_at: string;
}

export interface PrincipalMeResponse {
  ok: true;
  principal: PrincipalPublic;
}

export interface PrincipalReportRequest {
  target_principal_id: string;
  content_ref?: string;
  reason: string;
  detail?: string;
}

export interface PrincipalBlockRequest {
  target_principal_id: string;
  reason?: string;
}

export interface PrincipalReportPublic {
  report_id: string;
  reporter_principal_id: string;
  target_principal_id: string;
  content_ref: string | null;
  reason: string;
  detail: string | null;
  status: 'open' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  resolved_by_principal_id: string | null;
  resolution: 'no_action' | 'warning' | 'temp_mute' | 'ban' | null;
  resolution_reason: string | null;
}

export interface PrincipalReportsResponse {
  ok: true;
  reports: PrincipalReportPublic[];
}

export interface PrincipalPolicyResponse {
  ok: true;
  terms_version: string;
  account_policy: string;
  recovery_mode: 'none';
  local_storage: string[];
  server_storage: string[];
  public_storage: string[];
  loss_warning: string;
  no_wallet_token_nft_claim: true;
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
// Web Economy API (account-gated, receipt-backed)
// ============================================================================

export interface WebShopCatalogItem {
  shop_key: string;
  item_type: string;
  name: string;
  tag: string;
  description: string;
  price_gold: number;
  currency: 'gold';
}

export interface WebShopCatalogResponse {
  items: WebShopCatalogItem[];
}

export interface WebWalletResponse {
  ok: true;
  character_id: string;
  balance_gold: number;
}

export interface WebShopPurchaseRequest {
  character_id: string;
  shop_key: string;
}

export interface WebShopPurchaseResponse {
  ok: true;
  item: {
    item_id: string;
    item_type: string;
    shop_key: string;
  };
  balance_gold: number;
}

export interface WebWorkStartRequest {
  character_id: string;
}

export interface WebWorkStartResponse {
  ok: true;
  character_id: string;
  contract_id: string;
  contract_type: 'temple_sweep';
  payout_gold: number;
  cooldown_seconds: number;
  min_duration_ms: number;
}

export interface WebWorkTickRequest {
  character_id: string;
  contract_id: string;
}

export interface WebWorkTickResponse {
  ok: true;
  character_id: string;
  contract_id: string;
  ticks_observed: number;
  ticks_required: number;
  remaining_ms: number;
  completed: boolean;
  credited_gold?: number;
  balance_gold?: number;
}

export interface WebEconomyProperty {
  property_id: string;
  zone: string;
  plot_id: string;
  district: string | null;
  status: PropertyStatus;
  owned_by_character: boolean;
  primary_price_gold: number;
  listed_price_gold: number | null;
  sale_count: number;
}

export interface WebPropertyBuyRequest {
  character_id: string;
  property_id: string;
}

export interface WebPropertyBuyResponse {
  ok: true;
  property: WebEconomyProperty;
  balance_gold: number;
}

export interface WebPropertyListRequest {
  character_id: string;
  property_id: string;
  price_gold: number;
}

export interface WebPropertyListResponse {
  ok: true;
  property: WebEconomyProperty;
}

export interface WebPropertyUnlistRequest {
  character_id: string;
  property_id: string;
}

export type WebPropertyUnlistResponse = WebPropertyListResponse;

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
