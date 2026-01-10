import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

import type { ClientMessage, ServerMessage } from '../../shared/protocol.js';
import { ServerMessages, parseClientMessage } from '../../shared/protocol.js';
import type { Player, TutorialProgress } from '../../shared/types.js';
import { TileCode } from '../../shared/types.js';
import { TICK_MS } from '../../shared/constants.js';
import type { MapName, SessionMeResponse, WorldStateResult } from '../../shared/http.js';
import { handleHttp } from './api/http.js';

import { createAuditLogger } from './audit/logger.js';
import { createReceiptsReader } from './audit/reader.js';
import { createAntiCheatRuntime, onChat, onMoveApplied, onMoveIntent } from './anticheat/detector.js';
import { applyThrottle, checkTemTimeout, handleTemResponse, issueTemChallenge, isThrottled } from './anticheat/tem.js';
import { loadSharedMap, createWorldState, toPublicPlayer } from './world/state.js';
import { indexFor, tryMove } from './world/movement.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const VERSION = '0.1.0';
const DEFAULT_GUEST_SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_GUEST_SESSION_CLEANUP_MS = 60 * 1000;
const MAX_GUEST_SESSIONS = 10_000;

function parseEnvMs(envValue: string | undefined, fallback: number, min: number): number {
  if (!envValue) return fallback;
  const parsed = parseInt(envValue, 10);
  if (Number.isFinite(parsed) && parsed >= min) return parsed;
  return fallback;
}

const GUEST_SESSION_TTL_MS = parseEnvMs(process.env.GUEST_SESSION_TTL_MS, DEFAULT_GUEST_SESSION_TTL_MS, 1000);
const GUEST_SESSION_CLEANUP_MS = parseEnvMs(
  process.env.GUEST_SESSION_CLEANUP_MS,
  DEFAULT_GUEST_SESSION_CLEANUP_MS,
  100
);

type Queued = { msg: ClientMessage; receivedAt: number };

type Session = {
  connId: string;
  ws: WebSocket;
  queue: Queued[];
  player: Player | null;
  guestToken: string | null;
  inWorld: boolean;
  currentMap: 'Rookguard' | 'Azura';
  tutorial: TutorialProgress;
  anti: ReturnType<typeof createAntiCheatRuntime>;
  lastMoveAppliedAt: number | null;
  lastChatAcceptedAt: number | null;
};

const sessions = new Map<string, Session>();
const audit = createAuditLogger();
const receiptsReader = createReceiptsReader('audit');

type GuestSession = { player_id: string; name: string; minted_at_ms: number; expires_at_ms: number };
const guestSessions = new Map<string, GuestSession>(); // key = guest_token
type SessionMeResult = SessionMeResponse | { error: string; status: number };

const worlds = {
  Rookguard: createWorldState(loadSharedMap('rookguard.json')),
  Azura: createWorldState(loadSharedMap('azura.json')),
} as const;

function pruneExpiredGuestSessions(now: number) {
  for (const [token, sess] of guestSessions) {
    if (sess.expires_at_ms <= now) {
      guestSessions.delete(token);
    }
  }
}

function resolveSessionMe(guest_token: string, expiredReason: string): SessionMeResult {
  const now = Date.now();
  const minted = guestSessions.get(guest_token);
  if (!minted) return { error: 'not_authenticated', status: 401 };

  if (minted.expires_at_ms <= now) {
    guestSessions.delete(guest_token);
    audit.write({
      player_id: minted.player_id,
      action: 'session_guest_expired',
      inputs: { reason: expiredReason },
      result: 'not_authenticated',
    });
    return { error: 'token_expired', status: 401 };
  }

  const ttl_ms_remaining = Math.max(0, minted.expires_at_ms - now);
  return {
    ok: true as const,
    player_id: minted.player_id,
    guest_token,
    name: minted.name,
    minted_at_ms: minted.minted_at_ms,
    expires_at_ms: minted.expires_at_ms,
    ttl_ms_remaining,
  };
}

// HTTP control plane
const httpServer = http.createServer((req, res) => {
  const handled = handleHttp(req, res, {
    getVersion: () => VERSION,
    getTickMs: () => TICK_MS,
    listMaps: () =>
      (Object.keys(worlds) as MapName[]).map((name) => ({
        name,
        width: worlds[name].map.width,
        height: worlds[name].map.height,
      })),
    getMap: (name: MapName) => {
      const w = worlds[name];
      if (!w) return null;
      return {
        name,
        width: w.map.width,
        height: w.map.height,
        spawn: w.map.spawn,
        landmarks: w.map.landmarks,
      };
    },
    queryReceipts: (params) => receiptsReader.query(params),
    mintGuestSession: () => {
      const now = Date.now();
      pruneExpiredGuestSessions(now);

      if (guestSessions.size >= MAX_GUEST_SESSIONS) {
        return { error: 'guest_session_capacity', status: 429 };
      }

      const player_id = `p_${randomUUID()}`;
      const guest_token = `gt_${randomUUID()}`;
      const name = `Guest_${player_id.slice(-4)}`;
      const expires_at_ms = now + GUEST_SESSION_TTL_MS;
      guestSessions.set(guest_token, { player_id, name, minted_at_ms: now, expires_at_ms });
      audit.write({
        player_id,
        action: 'session_guest_minted',
        inputs: {},
        result: 'ok',
      });
      return { player_id, guest_token, name };
    },
    getSessionMe: (guest_token: string) => resolveSessionMe(guest_token, 'expired_on_me'),
    getWorldPlayers: (map: MapName, query) => {
      const w = worlds[map];
      if (!w) return { error: 'unknown_map', status: 404 };

      let players = Array.from(w.players.values()).map(toPublicPlayer);
      if (query.limit) {
        const cap = Math.max(1, Math.min(query.limit, 500));
        players = players.slice(0, cap);
      }

      return { players };
    },
    getWorldState: (map: MapName, guest_token: string | null): WorldStateResult => {
      const w = worlds[map];
      if (!w) return { error: 'unknown_map', status: 404 };

      const now = Date.now();
      const me = guest_token ? resolveSessionMe(guest_token, 'expired_on_world_state') : null;
      if (me && 'error' in me) return me;

      const base = {
        ok: true as const,
        version: VERSION,
        tick_ms: TICK_MS,
        updated_at_ms: now,
        map: {
          name: map,
          width: w.map.width,
          height: w.map.height,
          spawn: w.map.spawn,
        },
        player_count: w.players.size,
      };

      if (me && me.ok) {
        return { ...base, me };
      }
      return base;
    },
  });

  if (!handled) {
    res.statusCode = 404;
    res.end('not found');
  }
});

// WebSocket data plane (attached to same port)
const wss = new WebSocketServer({ server: httpServer });

function worldFor(s: Session) {
  return worlds[s.currentMap];
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcastToMap(map: 'Rookguard' | 'Azura', message: ServerMessage, excludeConnId?: string) {
  const data = JSON.stringify(message);
  for (const [connId, s] of sessions) {
    if (excludeConnId && connId === excludeConnId) continue;
    if (!s.inWorld) continue;
    if (s.currentMap !== map) continue;
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
    currentMap: 'Rookguard',
    tutorial: { move: false, chat: false, tem: false, gate: false, complete: false },
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
      const w = worldFor(s);
      w.players.delete(s.player.id);
      broadcastToMap(s.currentMap, ServerMessages.playerLeft(s.player.id), connId);
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
        let player_id: string;
        let guest_token: string;
        let name: string;

        // HTTP-first: token provided
        if (msg.guest_token) {
          const nowMs = Date.now();
          const minted = guestSessions.get(msg.guest_token);

          if (!minted) {
            send(s.ws, ServerMessages.error('not_authenticated', 'Invalid guest token'));
            audit.write({
              player_id: s.connId,
              action: 'login',
              inputs: { guest_token_provided: true },
              result: 'invalid_token',
            });
            break;
          }

          if (minted.expires_at_ms <= nowMs) {
            guestSessions.delete(msg.guest_token);
            send(s.ws, ServerMessages.error('not_authenticated', 'Guest token expired'));
            audit.write({
              player_id: minted.player_id,
              action: 'session_guest_expired',
              inputs: { reason: 'expired_on_login' },
              result: 'not_authenticated',
            });
            break;
          }

          // bind session
          player_id = minted.player_id;
          guest_token = msg.guest_token;
          name = minted.name;

          // one-time use: prevent token replay
          guestSessions.delete(msg.guest_token);

          audit.write({
            player_id,
            action: 'login',
            inputs: { source: 'http_mint' },
            result: 'ok',
          });
        } else {
          // Legacy WS mint
          player_id = s.player?.id ?? `p_${randomUUID()}`;
          guest_token = `gt_${randomUUID()}`;
          name = `Guest_${player_id.slice(-4)}`;

          audit.write({
            player_id,
            action: 'login',
            inputs: { source: 'ws_mint' },
            result: 'ok',
          });
        }

        s.guestToken = guest_token;
        s.currentMap = 'Rookguard';
        s.tutorial = { move: false, chat: false, tem: false, gate: false, complete: false };
        s.player = {
          id: player_id,
          name,
          x: worlds.Rookguard.map.spawn.x,
          y: worlds.Rookguard.map.spawn.y,
          state: 'authenticated',
        };

        send(s.ws, ServerMessages.loginAck(player_id, guest_token, name));
        break;
      }

      case 'enter_world': {
        if (!requireAuth(s)) break;
        if (s.inWorld) break;

        if (s.currentMap === 'Azura' && !s.tutorial.complete) {
          send(s.ws, ServerMessages.error('not_in_world', 'Complete Rookguard training first'));
          audit.write({
            player_id: s.player!.id,
            action: 'enter_world',
            inputs: { map: 'Azura' },
            result: 'blocked_tutorial_incomplete',
          });
          break;
        }

        s.inWorld = true;
        s.player!.state = 'in_world';

        const w = worldFor(s);
        w.players.set(s.player!.id, s.player!);

        const nearby = Array.from(w.players.values())
          .filter((p) => p.id !== s.player!.id)
          .map(toPublicPlayer);

        audit.write({ player_id: s.player!.id, action: 'enter_world', inputs: {}, result: 'ok' });

        send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!), nearby));
        broadcastToMap(s.currentMap, ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);
        break;
      }

      case 'tem_response': {
        if (!requireAuth(s)) break;
        const out = handleTemResponse(s.anti.state, msg.response);
        if (out.outcome === 'passed') {
          audit.write({ player_id: s.player!.id, action: 'tem_challenge_passed', inputs: {}, result: 'passed' });
          if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
            s.tutorial.tem = true;
            audit.write({
              player_id: s.player!.id,
              action: 'tutorial_step_complete',
              inputs: { step: 'tem' },
              result: 'ok',
            });
          }
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
            if (s.currentMap === 'Rookguard' && !s.tutorial.tem) {
              s.tutorial.tem = true;
              audit.write({
                player_id: s.player!.id,
                action: 'tutorial_step_complete',
                inputs: { step: 'tem', via: 'chat' },
                result: 'ok',
              });
            }
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

        if (s.currentMap === 'Rookguard' && !s.tutorial.chat && msg.message.trim().length > 0) {
          s.tutorial.chat = true;
          audit.write({
            player_id: s.player!.id,
            action: 'tutorial_step_complete',
            inputs: { step: 'chat' },
            result: 'ok',
          });
        }

        audit.write({ player_id: s.player!.id, action: 'chat', inputs: { message: msg.message }, result: 'ok' });
        broadcastToMap(s.currentMap, ServerMessages.chatBroadcast(s.player!.id, s.player!.name, msg.message));
        break;
      }

      case 'move_intent': {
        if (!requireWorld(s)) break;

        // If Tem is active (including tutorial demo), movement is blocked until response.
        if (s.anti.state.temChallengeActive) {
          send(s.ws, ServerMessages.moveResult(false, s.player!.x, s.player!.y, 'rate_limited'));
          break;
        }

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

        const before = { x: s.player!.x, y: s.player!.y, map: s.currentMap };
        const w = worldFor(s);
        const res = tryMove(w.map, s.player!, msg.direction);
        s.lastMoveAppliedAt = now;

        if (res.ok) {
          const cadenceAct = onMoveApplied(s.anti, now);
          if (cadenceAct.action === 'request_tem') {
            audit.write({
              player_id: s.player!.id,
              action: 'cadence_suspected',
              inputs: cadenceAct.signal.details,
              result: 'suspected',
            });
            const out = issueTemChallenge(s.anti.state, now);
            if (out.outcome === 'issued') {
              send(s.ws, { type: 'tem_challenge', ...out.challenge });
              audit.write({
                player_id: s.player!.id,
                action: 'tem_challenge_issued',
                inputs: { trigger: cadenceAct.signal.type, details: cadenceAct.signal.details },
                result: 'challenge_sent',
              });
            }
          }
        }

        audit.write({
          player_id: s.player!.id,
          action: 'move_intent',
          inputs: { direction: msg.direction, from: before },
          result: res.ok ? 'ok' : 'rejected',
        });

        let finalX = res.x;
        let finalY = res.y;
        let transferred = false;

        if (res.ok) {
          const tile = w.map.tiles[indexFor(w.map, { x: res.x, y: res.y })] ?? TileCode.Wall;

          if (s.currentMap === 'Rookguard') {
            if (tile === TileCode.TutorialMove && !s.tutorial.move) {
              s.tutorial.move = true;
              audit.write({
                player_id: s.player!.id,
                action: 'tutorial_step_complete',
                inputs: { step: 'move' },
                result: 'ok',
              });
            }

            if (tile === TileCode.TutorialTem && !s.tutorial.tem) {
              const out = issueTemChallenge(s.anti.state, now);
              if (out.outcome === 'issued') {
                send(s.ws, { type: 'tem_challenge', ...out.challenge });
                audit.write({
                  player_id: s.player!.id,
                  action: 'tem_challenge_issued',
                  inputs: { trigger: 'tutorial_tem_demo' },
                  result: 'challenge_sent',
                });
              }
            }

            if (tile === TileCode.GateToAzura && !s.tutorial.complete) {
              if (s.tutorial.move && s.tutorial.chat && s.tutorial.tem) {
                s.tutorial.gate = true;
                s.tutorial.complete = true;
                audit.write({
                  player_id: s.player!.id,
                  action: 'gate_unlock',
                  inputs: {},
                  result: 'ok',
                });
                audit.write({
                  player_id: s.player!.id,
                  action: 'tutorial_completed',
                  inputs: {},
                  result: 'ok',
                });

                // Transfer to Azura spawn immediately.
                worlds.Rookguard.players.delete(s.player!.id);
                broadcastToMap('Rookguard', ServerMessages.playerLeft(s.player!.id), s.connId);

                s.currentMap = 'Azura';
                s.player!.x = worlds.Azura.map.spawn.x;
                s.player!.y = worlds.Azura.map.spawn.y;
                worlds.Azura.players.set(s.player!.id, s.player!);

                const nearbyAzura = Array.from(worlds.Azura.players.values())
                  .filter((p) => p.id !== s.player!.id)
                  .map(toPublicPlayer);

                send(s.ws, ServerMessages.worldState(toPublicPlayer(s.player!), nearbyAzura));
                broadcastToMap('Azura', ServerMessages.playerJoined(toPublicPlayer(s.player!)), s.connId);

                finalX = s.player!.x;
                finalY = s.player!.y;
                transferred = true;
              }
            }
          }
        }

        audit.write({
          player_id: s.player!.id,
          action: 'move_result',
          inputs: { to: { x: finalX, y: finalY, map: s.currentMap }, ok: res.ok, reason: res.reason },
          result: res.ok ? 'ok' : 'rejected',
        });

        send(s.ws, ServerMessages.moveResult(res.ok, finalX, finalY, res.reason));
        if (res.ok && !transferred) broadcastToMap(s.currentMap, ServerMessages.playerMoved(s.player!.id, finalX, finalY), s.connId);
        break;
      }
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) processSessionQueue(s, now);
}, TICK_MS);

setInterval(() => pruneExpiredGuestSessions(Date.now()), GUEST_SESSION_CLEANUP_MS);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP+WS listening on :${PORT}`);
  console.log(`HTTP health: http://localhost:${PORT}/v1/health`);
  console.log(`WS: ws://localhost:${PORT}`);
});
