import type { Direction, MapData, PlayerPublic, PlayerStatus, PlayLoopProgress, SovereignVocation } from '@shared/types';
import type {
  AccountCharacterCreateRequest,
  AccountCharacterOutfitOption,
  AccountCharacterPublic,
  AccountCharacterSex,
  AccountCharacterWorldOption,
  MapName,
} from '@shared/http';
import type { ChronicleEvent, PropertyPublic } from '@shared/protocol';

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
  // Identity v0.1 (#148): signed auth token when logged in as a created
  // character; null for guest play. `authenticated` distinguishes the two.
  token: string | null;
  authenticated: boolean;
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

export type CharacterSex = AccountCharacterSex;
export type CharacterWorldOption = AccountCharacterWorldOption;
export type CharacterOutfitOption = AccountCharacterOutfitOption;

export interface CharacterCatalog {
  worlds: CharacterWorldOption[];
  outfits: CharacterOutfitOption[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

export type AccountCharacter = AccountCharacterPublic;

export interface AccountSessionStatus {
  checking: boolean;
  checked: boolean;
  authenticated: boolean;
  csrfReady: boolean;
  emailVerified: boolean;
  message: string | null;
}

export type CharacterCreateInput = AccountCharacterCreateRequest;

export interface CreateResult {
  ok: boolean;
  error?: string;
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
  // Property Ownership v0: house registry, keyed by property_id (server-authoritative).
  properties: Map<string, PropertyPublic>;
}

export interface GameClientApi {
  sendMove: (dir: InputDirection) => void;
  releaseMove: (dir: InputDirection) => void;
  stopMoves: () => void;
  sendAttack: () => void;
  castRunestone: () => void;
  talkToNpc: (npcId: string) => void;
  declareVocation: (vocation: SovereignVocation) => void;
  useSkill: (skillId: string, targetId?: string) => void;
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
  relog: () => void;
  // Identity v0.1 (#148): create/select a character (mints or issues a signed
  // token), then play as that character. signOut clears the stored token and
  // falls back to guest.
  createCharacter: (input: CharacterCreateInput) => Promise<CreateResult>;
  selectCharacter: (characterId: string) => Promise<CreateResult>;
  signOut: () => void;
  characterCatalog: CharacterCatalog;
  accountCharacters: AccountCharacter[];
  accountSession: AccountSessionStatus;
  refreshAccountSession: () => Promise<AccountSessionStatus>;
  loadAccountCharacters: () => Promise<AccountCharacter[]>;
  openChat: () => void;
  closeChat: () => void;
  // Property Ownership v0
  buyHouse: (propertyId: string) => void;
  listHouse: (propertyId: string, price: number) => void;
  unlistHouse: (propertyId: string) => void;
}
