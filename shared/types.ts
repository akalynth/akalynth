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

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  state: PlayerState;
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

export const TEM_CHALLENGE_RESPONSE = 'AZURA';
export const THROTTLE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const SIGNAL_DECAY_MS = 60 * 1000; // 60 seconds
