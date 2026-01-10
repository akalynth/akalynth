// Akalynth Shared Types
// Used by both server and client

// ============================================================================
// Positions & Tiles
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export type Direction = 'north' | 'south' | 'east' | 'west';

export const DIRECTION_OFFSETS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export enum TileType {
  Grass = 0,
  Stone = 1,
  Wall = 2,
  Water = 3,
  Door = 4,
}

export enum TileCode {
  Grass = 0,
  Stone = 1,
  Wall = 2,
  Water = 3,
  Door = 4,

  TutorialMove = 5,
  TutorialChat = 6,
  TutorialTem = 7,
  GateToAzura = 8,
}

export const WALKABLE_TILES = new Set<number>([
  TileCode.Grass,
  TileCode.Stone,
  TileCode.TutorialMove,
  TileCode.TutorialChat,
  TileCode.TutorialTem,
  TileCode.GateToAzura,
]);

// ============================================================================
// Players
// ============================================================================

export type PlayerStatus = 'alive' | 'dead';

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  state: PlayerState;
  status: PlayerStatus;
  dead_until_ms?: number | null;
  reputation?: number;
}

export type PlayerState = 'connected' | 'authenticated' | 'in_world';

export type TutorialStep = 'move' | 'chat' | 'tem' | 'gate';

export interface TutorialProgress {
  move: boolean;
  chat: boolean;
  tem: boolean;
  gate: boolean;
  complete: boolean;
}

export interface PlayerPublic {
  id: string;
  name: string;
  x: number;
  y: number;
  status: PlayerStatus;
  dead_until_ms?: number | null;
  reputation?: number;
}

// ============================================================================
// Map Data
// ============================================================================

export interface Landmark {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HousePlot extends Landmark {
  id: string;
}

export interface MapData {
  name: string;
  width: number;
  height: number;
  spawn: Position;
  tiles: number[]; // Flat array, index = y * width + x
  landmarks: {
    guild_hall: Landmark;
    house_plots: HousePlot[];
    plaza: Landmark;
  };
}

// Protocol/docs terminology: the game "World" is the loaded map + landmarks.
export type World = MapData;

// ============================================================================
// Anti-Cheat
// ============================================================================

export type SignalType =
  | 'speed_violation'
  | 'pathing_anomaly'
  | 'action_cadence'
  | 'repeated_timing'
  | 'perfect_cadence'
  | 'chat_spam';

export interface Signal {
  type: SignalType;
  timestamp: number;
  details: Record<string, unknown>;
}

export type EnforcementLevel = 'warn' | 'tem_challenge' | 'throttle' | 'kick' | 'temp_ban';

export interface AntiCheatState {
  signals: Signal[];
  warnCount: number;
  temChallengeActive: boolean;
  temChallengeId: string | null;
  temChallengeExpires: number | null;
  throttleUntil: number | null;
  kickCount: number;
}

// ============================================================================
// Audit
// ============================================================================

export interface AuditReceipt {
  timestamp: string;
  player_id: string;
  action: string;
  inputs: Record<string, unknown>;
  result: string;
  evidence_hash?: string;
}

export const LEDGER_HESITATION_ACTION = 'ledger_hesitation';
export const RUMOR_SEEDED_ACTION = 'rumor_seeded';
export const LEGEND_SIGHTED_ACTION = 'legend_sighted';
export const LEGEND_ATTEMPTED_ACTION = 'legend_attempted';
export const LEGEND_REFUSED_ACTION = 'legend_refused';
export const FIRST_ATTEMPT_STONE_ACTION = 'first_attempt_stone_cannot_obtain';

export type DeathReceiptAction = 'death' | 'respawn' | 'death_penalty_applied';

export const TEM_CHALLENGE_RESPONSE = 'AZURA';
export const THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const SIGNAL_DECAY_MS = 60 * 1000; // 60 seconds

// ============================================================================
// Death
// ============================================================================

export type DeathCause = 'test' | 'player' | 'npc' | 'environment' | 'unknown';

// ============================================================================
// Runestone
// ============================================================================

export type Element = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'shadow';

export const ELEMENTS: Element[] = ['fire', 'water', 'earth', 'air', 'light', 'shadow'];

export type RunestoneDenialReason = 'cooldown' | 'not_near_table' | 'not_authorized' | 'rate_limited';

// Runestone receipt actions
export const RUNESTONE_CAST_ACTION = 'runestone_cast';
export const RUNESTONE_RESULT_ACTION = 'runestone_result';
export const RUNESTONE_DENIED_ACTION = 'runestone_denied';
export const TRINITY_OF_SHADOW_ACTION = 'trinity_of_shadow';
