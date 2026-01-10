import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

import type { ClientMessage, ServerMessage } from '../../shared/protocol.js';
import { ServerMessages, parseClientMessage } from '../../shared/protocol.js';
import type { Player } from '../../shared/types.js';
import { GAME_TICK_MS } from '../../shared/types.js';

import { createAuditLogger } from './audit/logger.js';
import { createAntiCheatRuntime, onChat, onMoveIntent } from './anticheat/detector.js';
import { applyThrottle, checkTemTimeout, handleTemResponse, issueTemChallenge, isThrottled } from './anticheat/tem.js';
import { loadAzuraMap, createWorldState, toPublicPlayer } from './world/state.js';
import { tryMove } from './world/movement.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const VERSION = '0.1.0';

type Queued = { msg: ClientMessage; receivedAt: number };

type Session = {
  connId: string;
  ws: WebSocket;
  queue: Queued[];
  player: Player | null;
  guestToken: string | null;
  inWorld: boolean;
  anti: ReturnType<typeof createAntiCheatRuntime>;
  lastMoveAppliedAt: number | null;
  lastChatAcceptedAt: number | null;
};

const wss = new WebSocketServer({ port: PORT });
const sessions = new Map<string, Session>();
const audit = createAuditLogger();

const world = createWorldState(loadAzuraMap());

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message: ServerMessage, excludeConnId?: string) {
  const data = JSON.stringify(message);
  for (const [connId, s] of sessions) {
    if (excludeConnId && connId === excludeConnId) continue;
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(data);
  }
}

function kick(s: Session, reason: string) {
  audit.write({
    player_id: s.player?.id ?? s.connId,
    action: 'kick',
    inputs: { reason },
    result: 'kicked',
  });
  send(s.ws, ServerMessages.error('kicked', reason));
  try {
    s.ws.close();
  } catch {
    // ignore
  }
}

function requireAuth(s: Session): boolean {
  if (!s.player) {
    send(s.ws, ServerMessages.error('not_authenticated', 'Login required'));
    return false;
  }
  return true;
}

function requireWorld(s: Session): boolean {
  if (!requireAuth(s)) return false;
  if (!s.inWorld) {
    send(s.ws, ServerMessages.error('not_in_world', 'Enter world first'));
    return false;
  }
  return true;
}

wss.on('connection', (ws) => {
  const connId = randomUUID();
  const now = Date.now();
  const s: Session = {
    connId,
    ws,
    queue: [],
    player: null,
    guestToken: null,
    inWorld: false,
    anti: createAntiCheatRuntime(now),
    lastMoveAppliedAt: null,
    lastChatAcceptedAt: null,
  };

  sessions.set(connId, s);
  audit.write({ player_id: connId, action: 'connect', inputs: {}, result: 'connected' });
  send(ws, ServerMessages.welcome(VERSION));

  ws.on('message', (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      send(ws, ServerMessages.error('invalid_message', 'Invalid JSON'));
      audit.write({ player_id: s.player?.id ?? connId, action: 'invalid_message', inputs: {}, result: 'bad_json' });
      return;
    }

    const msg = parseClientMessage(parsed);
    if (!msg) {
      send(ws, ServerMessages.error('invalid_message', 'Unknown or malformed message'));
      audit.write({
        player_id: s.player?.id ?? connId,
        action: 'invalid_message',
        inputs: { raw: parsed },
        result: 'unparseable',
      });
      return;
    }

    s.queue.push({ msg, receivedAt: Date.now() });
  });

  ws.on('close', () => {
    sessions.delete(connId);
    if (s.player && s.inWorld) {
      world.players.delete(s.player.id);
      broadcast(ServerMessages.playerLeft(s.player.id), connId);
      audit.write({ player_id: s.player.id, action: 'disconnect', inputs: {}, result: 'left_world' });
    } else {
      audit.write({ player_id: connId, action: 'disconnect', inputs: {}, result: 'disconnected' });
    }
  });

  ws.on('error', (err) => {
    audit.write({
      player_id: s.player?.id ?? connId,
      action: 'ws_error',
      inputs: { message: err.message },
      result: 'error',
    });
  });
});

function processSessionQueue(s: Session, now: number) {
  // Tem timeout enforcement
  const timeoutOutcome = checkTemTimeout(s.anti.state, now);
  if (timeoutOutcome.outcome === 'failed') {
    applyThrottle(s.anti.state, now);
    audit.write({
      player_id: s.player?.id ?? s.connId,
      action: 'tem_challenge_failed',
      inputs: { reason: timeoutOutcome.reason },
      result: 'throttled',
    });
  }

  // process up to N messages per tick to bound work
  let processed = 0;
  while (s.queue.length && processed < 25) {
    processed++;
    const { msg } = s.queue.shift()!;

    switch (msg.type) {
      case 'connect': {
        // idempotent
        audit.write({ player_id: s.player?.id ?? s.connId, action: 'connect', inputs: {}, result: 'ok' });
        send(s.ws, ServerMessages.welcome(VERSION));
        break;
      }

      case 'login': {
        const player_id = s.player?.id ?? `p_${randomUUID()}`;
        const guest_token = msg.guest_token ?? `gt_${randomUUID()}`;
        const name = `Guest_${player_id.slice(-4)}`;

        s.guestToken = guest_token;
        s.player = { id: player_id, name, x: world.map.spawn.x, y: world.map.spawn.y, state: 'authenticated' };

        audit.write({
          player_id,
          action: 'login',
          inputs: { guest_token_provided: !!msg.guest_token },
          result: 'ok',
        });

        send(s.ws, ServerMessages.loginAck(player_id, guest_token, name));
        break;
      }

      case 'enter_world': {
        if (!requireAuth(s)) break;
        if (s.inWorld) break;

        s.inWorld = true;
        s.player!.state = 'in_world';

        world.players.set(s.player!.id, s.player!);

        const nearby = Array.from(world.players.values())
          .filter((p) => p.id !== s.player!.id)
          .map(toPublicPlayer);

        audit.write({ player_id: s.player!.id, action: 'enter_world', inputs: {}, result: 'ok' });

        send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!), nearby));
        broadcast(ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);
        break;
      }

      case 'tem_response': {
        if (!requireAuth(s)) break;
        const out = handleTemResponse(s.anti.state, msg.response);
        if (out.outcome === 'passed') {
          audit.write({ player_id: s.player!.id, action: 'tem_challenge_passed', inputs: {}, result: 'passed' });
        } else if (out.outcome === 'failed') {
          applyThrottle(s.anti.state, now);
          audit.write({
            player_id: s.player!.id,
            action: 'tem_challenge_failed',
            inputs: { reason: out.reason },
            result: 'throttled',
          });
        }
        break;
      }

      case 'chat': {
        if (!requireWorld(s)) break;

        // Tem challenge response via chat, per docs
        if (s.anti.state.temChallengeActive) {
          const out = handleTemResponse(s.anti.state, msg.message);
          if (out.outcome === 'passed') {
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_passed',
              inputs: { via: 'chat' },
              result: 'passed',
            });
            break;
          }
          if (out.outcome === 'failed') {
            applyThrottle(s.anti.state, now);
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_failed',
              inputs: { via: 'chat', reason: out.reason },
              result: 'throttled',
            });
            break;
          }
        }

        if (isThrottled(s.anti.state, now)) {
          const last = s.lastChatAcceptedAt ?? 0;
          if (now - last < 10_000) {
            send(s.ws, ServerMessages.error('rate_limited', 'Chat throttled'));
            audit.write({
              player_id: s.player!.id,
              action: 'chat',
              inputs: { message: msg.message },
              result: 'rate_limited',
            });
            break;
          }
        }

        s.lastChatAcceptedAt = now;
        const act = onChat(s.anti, now);
        if (act.action === 'throttle') {
          applyThrottle(s.anti.state, now);
          audit.write({
            player_id: s.player!.id,
            action: 'throttle',
            inputs: { trigger: act.signal.type, details: act.signal.details },
            result: 'applied',
          });
        }
        if (act.action === 'kick') {
          audit.write({
            player_id: s.player!.id,
            action: 'kick',
            inputs: { trigger: act.signal.type, reason: act.reason },
            result: 'kicked',
          });
          kick(s, act.reason);
          break;
        }

        audit.write({ player_id: s.player!.id, action: 'chat', inputs: { message: msg.message }, result: 'ok' });
        broadcast(ServerMessages.chatBroadcast(s.player!.id, s.player!.name, msg.message));
        break;
      }

      case 'move_intent': {
        if (!requireWorld(s)) break;

        const act = onMoveIntent(s.anti, now);
        if (act.action === 'request_tem') {
          const out = issueTemChallenge(s.anti.state, now);
          if (out.outcome === 'issued') {
            send(s.ws, { type: 'tem_challenge', ...out.challenge });
            audit.write({
              player_id: s.player!.id,
              action: 'tem_challenge_issued',
              inputs: { trigger: act.signal.type, details: act.signal.details },
              result: 'challenge_sent',
            });
          }
          // During challenge, ignore movement.
          send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
          break;
        }

        if (isThrottled(s.anti.state, now)) {
          const last = s.lastMoveAppliedAt ?? 0;
          if (now - last < 200) {
            send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
            audit.write({
              player_id: s.player!.id,
              action: 'move_intent',
              inputs: { direction: msg.direction },
              result: 'rate_limited',
            });
            break;
          }
        }

        const before = { x: s.player!.x, y: s.player!.y };
        const res = tryMove(world.map, s.player!, msg.direction);
        s.lastMoveAppliedAt = now;

        audit.write({
          player_id: s.player!.id,
          action: 'move_intent',
          inputs: { direction: msg.direction, from: before },
          result: res.ok ? 'ok' : 'rejected',
        });
        audit.write({
          player_id: s.player!.id,
          action: 'move_result',
          inputs: { to: { x: res.x, y: res.y }, ok: res.ok, reason: res.reason },
          result: res.ok ? 'ok' : 'rejected',
        });

        send(s.ws, ServerMessages.moveResult(res.ok, res.x, res.y, res.reason));
        if (res.ok) broadcast(ServerMessages.playerMoved(s.player!.id, res.x, res.y), s.connId);
        break;
      }
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) processSessionQueue(s, now);
}, GAME_TICK_MS);

console.log(`Akalynth server listening on ws://0.0.0.0:${PORT}`);
