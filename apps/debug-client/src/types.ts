import type { Direction, MapData, PlayerPublic, PlayerStatus } from '@shared/types';
import type { MapName } from '@shared/http';

export type InputDirection =
  | Direction
  | 'north_east'
  | 'south_east'
  | 'south_west'
  | 'north_west';

export interface WorldSnapshot {
  map: MapData;
  me: PlayerPublic | null;
  others: Map<string, PlayerPublic>;
}

export interface ConnectionState {
  phase: 'idle' | 'connecting' | 'awaiting_world_state' | 'connected' | 'error' | 'disconnected';
  reason?: string;
  lastServerAt?: number;
}

export interface SessionInfo {
  guestToken: string | null;
  playerId: string | null;
  name: string | null;
  status: PlayerStatus;
}

export interface MoveIntent {
  id: number;
  dir: Direction;
  issuedAt: number;
}

export interface ActionCooldown {
  attackEndsAt: number;
}

export interface UiStage {
  stage: 0 | 1 | 2 | 3;
}

export interface ChatMessageEntry {
  id: string;
  from: string;
  message: string;
  at: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  at: number;
  ttlMs: number;
}

export interface GameClientState {
  world: WorldSnapshot;
  conn: ConnectionState;
  session: SessionInfo;
  cooldowns: ActionCooldown;
  ui: UiStage;
  chat: ChatMessageEntry[];
  combat: {
    targetId: string | null;
    fx: FloatingText[];
  };
}

export interface GameClientApi {
  sendMove: (dir: InputDirection) => void;
  releaseMove: (dir: InputDirection) => void;
  stopMoves: () => void;
  sendAttack: () => void;
  sendChat: (message: string) => void;
  setTarget: (playerId: string | null) => void;
  setStage: (stage: UiStage['stage']) => void;
  toggleMap: (map: MapName) => void;
  openChat: () => void;
  closeChat: () => void;
}
