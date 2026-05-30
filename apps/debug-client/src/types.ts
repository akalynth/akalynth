import type { Direction, MapData, PlayerPublic, PlayerStatus, PlayLoopProgress } from '@shared/types';
import type { MapName } from '@shared/http';
import type { ChronicleEvent } from '@shared/protocol';

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

export interface ToastNotice {
  id: string;
  title: string;
  detail?: string;
  at: number;
  expiresAt: number;
}

export interface LostItemCount {
  kind: string;
  qty: number;
}

export interface DeathRecap {
  deathEvent: ChronicleEvent;
  lost: LostItemCount[];
  selectedBy?: 'group' | 'time' | 'latest';
}

export interface GameClientState {
  world: WorldSnapshot;
  conn: ConnectionState;
  session: SessionInfo;
  cooldowns: ActionCooldown;
  ui: UiStage;
  chat: ChatMessageEntry[];
  loop: PlayLoopProgress | null;
  toast: ToastNotice | null;
  recapOpen: boolean;
  deathRecap: DeathRecap | null;
  recapRequestedAt: number | null;
  recapPreferredGroupId: number | null;
  chronicleOpen: boolean;
  chronicle: {
    events: ChronicleEvent[];
    hasMore: boolean;
    loading: boolean;
    before: string | null;
  } | null;
  combat: {
    targetId: string | null;
    fx: FloatingText[];
  };
  groundItems: Map<string, { item_id: string; item_type: string; x: number; y: number }>;
  workContract: {
    contract_id: string;
    payout_gold: number;
    ticks_observed: number;
    ticks_required: number;
    remaining_ms: number;
  } | null;
  inventory: { item_id: string; item_type: string; slot?: string | null }[];
  gold: number;
}

export interface GameClientApi {
  sendMove: (dir: InputDirection) => void;
  releaseMove: (dir: InputDirection) => void;
  stopMoves: () => void;
  sendAttack: () => void;
  castRunestone: () => void;
  talkToNpc: (npcId: string) => void;
  pickupItem: (itemId: string) => void;
  startWork: () => void;
  tickWork: () => void;
  sendChat: (message: string) => void;
  requestChronicle: (limit?: number, openRecap?: boolean) => void;
  openChronicle: () => void;
  closeChronicle: () => void;
  loadMoreChronicle: () => void;
  openRecapFromChronicle: (anchor: {
    timestamp: string;
    chronicle_event_id?: number | null;
    zone?: string | null;
    x?: number | null;
    y?: number | null;
  }) => void;
  closeRecap: () => void;
  setTarget: (playerId: string | null) => void;
  setStage: (stage: UiStage['stage']) => void;
  toggleMap: (map: MapName) => void;
  openChat: () => void;
  closeChat: () => void;
}
