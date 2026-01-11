// Akalynth Protocol Messages
// All messages sent over WebSocket

import type { Direction, Element, PlayerPublic, RunestoneDenialReason } from './types';
import { ELEMENTS } from './types';
import type { MapName } from './http';

// ============================================================================
// Base Message
// ============================================================================

export interface BaseMessage {
  type: string;
}

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface ConnectMessage extends BaseMessage {
  type: 'connect';
}

export interface LoginMessage extends BaseMessage {
  type: 'login';
  guest_token: string | null;
}

export interface EnterWorldMessage extends BaseMessage {
  type: 'enter_world';
}

export interface MoveIntentMessage extends BaseMessage {
  type: 'move_intent';
  direction: Direction;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  message: string;
}

export interface TemResponseMessage extends BaseMessage {
  type: 'tem_response';
  response: string;
}

export interface KillSelfMessage extends BaseMessage {
  type: 'kill_self';
}

export interface RunestoneCastMessage extends BaseMessage {
  type: 'runestone_cast';
  table_id: string;
  guess: Element | null;
}

export type WitnessResponse = 'confirm' | 'deny' | 'uncertain';

export interface TemWitnessResponseMessage extends BaseMessage {
  type: 'tem_witness_response';
  request_id: string;
  response: WitnessResponse;
}

export type ClientMessage =
  | ConnectMessage
  | LoginMessage
  | EnterWorldMessage
  | MoveIntentMessage
  | ChatMessage
  | TemResponseMessage
  | KillSelfMessage
  | RunestoneCastMessage
  | TemWitnessResponseMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface WelcomeMessage extends BaseMessage {
  type: 'welcome';
  version: string;
}

export interface LoginAckMessage extends BaseMessage {
  type: 'login_ack';
  ok?: boolean;
  player_id: string;
  guest_token: string;
  name: string;
  reason?: string;
}

export interface WorldStateMessage extends BaseMessage {
  type: 'world_state';
  player: PlayerPublic;
  nearby_players: PlayerPublic[];
}

export interface MoveResultMessage extends BaseMessage {
  type: 'move_result';
  ok: boolean;
  x: number;
  y: number;
  reason: string | null;
}

export interface PlayerMovedMessage extends BaseMessage {
  type: 'player_moved';
  player_id: string;
  x: number;
  y: number;
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: 'player_joined';
  player: PlayerPublic;
}

export interface PlayerLeftMessage extends BaseMessage {
  type: 'player_left';
  player_id: string;
}

export interface ChatBroadcastMessage extends BaseMessage {
  type: 'chat_broadcast';
  player_id: string;
  name: string;
  message: string;
}

export interface TemChallengeMessage extends BaseMessage {
  type: 'tem_challenge';
  challenge_id: string;
  message: string;
  timeout_seconds: number;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

export interface DeathNoticeMessage extends BaseMessage {
  type: 'death_notice';
  ok: true;
  respawn_in_ms: number;
  map: MapName;
  spawn: { x: number; y: number };
  reason: string;
}

export type ErrorCode =
  | 'invalid_message'
  | 'not_authenticated'
  | 'not_in_world'
  | 'rate_limited'
  | 'kicked';

export interface RunestoneResultMessage extends BaseMessage {
  type: 'runestone_result';
  table_id: string;
  caster: { id: string; name: string };
  face: Element;
  whisper: string;
}

export interface RunestoneDeniedMessage extends BaseMessage {
  type: 'runestone_denied';
  reason: RunestoneDenialReason;
}

export interface TemWitnessRequestMessage extends BaseMessage {
  type: 'tem_witness_request';
  request_id: string;
  timestamp: string;
  map: MapName;
  target_actor: string;
  prompt: string;
  kind: 'heat_penalty';
}

export type ServerMessage =
  | WelcomeMessage
  | LoginAckMessage
  | WorldStateMessage
  | MoveResultMessage
  | PlayerMovedMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ChatBroadcastMessage
  | TemChallengeMessage
  | ErrorMessage
  | DeathNoticeMessage
  | RunestoneResultMessage
  | RunestoneDeniedMessage
  | TemWitnessRequestMessage;

// ============================================================================
// Message Factories
// ============================================================================

export const ServerMessages = {
  welcome: (version: string): WelcomeMessage => ({
    type: 'welcome',
    version,
  }),

  loginAck: (
    player_id: string,
    guest_token: string,
    name: string,
    ok: boolean = true,
    reason?: string
  ): LoginAckMessage => ({
    type: 'login_ack',
    ok,
    player_id,
    guest_token,
    name,
    reason,
  }),

  worldState: (player: PlayerPublic, nearby_players: PlayerPublic[]): WorldStateMessage => ({
    type: 'world_state',
    player,
    nearby_players,
  }),

  moveResult: (ok: boolean, x: number, y: number, reason: string | null = null): MoveResultMessage => ({
    type: 'move_result',
    ok,
    x,
    y,
    reason,
  }),

  playerMoved: (player_id: string, x: number, y: number): PlayerMovedMessage => ({
    type: 'player_moved',
    player_id,
    x,
    y,
  }),

  playerJoined: (player: PlayerPublic): PlayerJoinedMessage => ({
    type: 'player_joined',
    player,
  }),

  playerLeft: (player_id: string): PlayerLeftMessage => ({
    type: 'player_left',
    player_id,
  }),

  chatBroadcast: (player_id: string, name: string, message: string): ChatBroadcastMessage => ({
    type: 'chat_broadcast',
    player_id,
    name,
    message,
  }),

  temChallenge: (challenge_id: string, timeout_seconds: number): TemChallengeMessage => ({
    type: 'tem_challenge',
    challenge_id,
    message: `Hi! Type AZURA in chat within ${timeout_seconds} seconds.`,
    timeout_seconds,
  }),

  deathNotice: (
    respawn_in_ms: number,
    map: MapName,
    spawn: { x: number; y: number },
    reason: string
  ): DeathNoticeMessage => ({
    type: 'death_notice',
    ok: true,
    respawn_in_ms,
    map,
    spawn,
    reason,
  }),

  error: (code: ErrorCode, message: string): ErrorMessage => ({
    type: 'error',
    code,
    message,
  }),

  runestoneResult: (
    table_id: string,
    caster: { id: string; name: string },
    face: Element,
    whisper: string
  ): RunestoneResultMessage => ({
    type: 'runestone_result',
    table_id,
    caster,
    face,
    whisper,
  }),

  runestoneDenied: (reason: RunestoneDenialReason): RunestoneDeniedMessage => ({
    type: 'runestone_denied',
    reason,
  }),

  temWitnessRequest: (
    request_id: string,
    timestamp: string,
    map: MapName,
    target_actor: string,
    prompt: string,
    kind: 'heat_penalty'
  ): TemWitnessRequestMessage => ({
    type: 'tem_witness_request',
    request_id,
    timestamp,
    map,
    target_actor,
    prompt,
    kind,
  }),
};

// ============================================================================
// Type Guards
// ============================================================================

export function isValidDirection(d: unknown): d is Direction {
  return d === 'north' || d === 'south' || d === 'east' || d === 'west';
}

export function parseClientMessage(data: unknown): ClientMessage | null {
  if (typeof data !== 'object' || data === null) return null;

  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== 'string') return null;

  switch (msg.type) {
    case 'connect':
      return { type: 'connect' };

    case 'login':
      return {
        type: 'login',
        guest_token: typeof msg.guest_token === 'string' ? msg.guest_token : null,
      };

    case 'enter_world':
      return { type: 'enter_world' };

    case 'move_intent':
      if (!isValidDirection(msg.direction)) return null;
      return { type: 'move_intent', direction: msg.direction };

    case 'chat':
      if (typeof msg.message !== 'string') return null;
      return { type: 'chat', message: msg.message };

    case 'tem_response':
      if (typeof msg.response !== 'string') return null;
      return { type: 'tem_response', response: msg.response };

    case 'kill_self':
      return { type: 'kill_self' };

    case 'runestone_cast': {
      if (typeof msg.table_id !== 'string') return null;
      const guess = typeof msg.guess === 'string' && ELEMENTS.includes(msg.guess as Element)
        ? (msg.guess as Element)
        : null;
      return { type: 'runestone_cast', table_id: msg.table_id, guess };
    }

    case 'tem_witness_response': {
      const request_id = typeof msg.request_id === 'string' ? msg.request_id : null;
      const response = msg.response;
      if (!request_id) return null;
      if (response !== 'confirm' && response !== 'deny' && response !== 'uncertain') return null;
      return {
        type: 'tem_witness_response',
        request_id,
        response,
      };
    }

    default:
      return null;
  }
}
