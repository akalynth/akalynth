// Akalynth Protocol Messages
// All messages sent over WebSocket

import type { Direction, PlayerPublic } from './types';

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

export type ClientMessage =
  | ConnectMessage
  | LoginMessage
  | EnterWorldMessage
  | MoveIntentMessage
  | ChatMessage
  | TemResponseMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface WelcomeMessage extends BaseMessage {
  type: 'welcome';
  version: string;
}

export interface LoginAckMessage extends BaseMessage {
  type: 'login_ack';
  player_id: string;
  guest_token: string;
  name: string;
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

export type ErrorCode =
  | 'invalid_message'
  | 'not_authenticated'
  | 'not_in_world'
  | 'rate_limited'
  | 'kicked';

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
  | ErrorMessage;

// ============================================================================
// Message Factories
// ============================================================================

export const ServerMessages = {
  welcome: (version: string): WelcomeMessage => ({
    type: 'welcome',
    version,
  }),

  loginAck: (player_id: string, guest_token: string, name: string): LoginAckMessage => ({
    type: 'login_ack',
    player_id,
    guest_token,
    name,
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
    message: `Hi! Type ${timeout_seconds > 10 ? 'AZURA' : 'AZURA'} in chat within ${timeout_seconds} seconds.`,
    timeout_seconds,
  }),

  error: (code: ErrorCode, message: string): ErrorMessage => ({
    type: 'error',
    code,
    message,
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

    default:
      return null;
  }
}
