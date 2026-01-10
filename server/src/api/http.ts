// server/src/api/http.ts
// HTTP Control Plane router (zero dependencies)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type {
  MapName,
  HealthResponse,
  MapsListResponse,
  MapDetailResponse,
  GuestSessionResponse,
  SessionMeResponse,
  WorldPlayersResponse,
  WorldStateResult,
  ReceiptsQueryParams,
  ReceiptsResponse,
  PublicReceiptsQueryParams,
  PublicReceiptsResponse,
  PublicRumorsQueryParams,
  PublicRumorsResponse,
  WorldPlayersQuery,
} from '../../../shared/http.js';

type GuestSessionMintResult = GuestSessionResponse | { error: string; status?: number };
type SessionMeResult = SessionMeResponse | { error: string; status: number };
type WorldPlayersResult = WorldPlayersResponse | { error: string; status: number };
type PublicReceiptsRawResult = ReceiptsResponse | { error: string; status: number };

export interface ApiDeps {
  getVersion: () => string;
  getTickMs: () => number;
  listMaps: () => Array<{ name: MapName; width: number; height: number }>;
  getMap: (name: MapName) => MapDetailResponse | null;
  mintGuestSession?: () => GuestSessionMintResult;
  getSessionMe?: (guest_token: string) => SessionMeResult;
  getWorldPlayers?: (map: MapName, query: WorldPlayersQuery) => WorldPlayersResult;
  getWorldState?: (map: MapName, guest_token: string | null) => WorldStateResult;
  queryReceipts: (params: ReceiptsQueryParams) => ReceiptsResponse;
  queryPublicReceipts?: (params: PublicReceiptsQueryParams) => PublicReceiptsResponse;
  queryPublicReceiptsRaw?: (params: PublicReceiptsQueryParams) => PublicReceiptsRawResult;
  queryPublicRumors?: (params: PublicRumorsQueryParams) => PublicRumorsResponse;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function notFound(res: ServerResponse) {
  res.statusCode = 404;
  res.end('not found');
}

function methodNotAllowed(res: ServerResponse) {
  res.statusCode = 405;
  res.end('method not allowed');
}

function isMapName(x: string): x is MapName {
  return x === 'Rookguard' || x === 'Azura';
}

function isGuestSessionError(x: GuestSessionMintResult): x is { error: string; status?: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

function isSessionMeError(x: SessionMeResult): x is { error: string; status: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

function isWorldPlayersError(x: WorldPlayersResult): x is { error: string; status: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

function isWorldStateError(x: WorldStateResult): x is { error: string; status: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

function isPublicReceiptsRawError(x: PublicReceiptsRawResult): x is { error: string; status: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

export function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ApiDeps
): boolean {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const method = (req.method ?? 'GET').toUpperCase();

  // Health
  if (method === 'GET' && path === '/v1/health') {
    const body: HealthResponse = {
      ok: true,
      version: deps.getVersion(),
      tick_ms: deps.getTickMs(),
      now_iso: new Date().toISOString(),
    };
    json(res, 200, body);
    return true;
  }

  // Maps list
  if (method === 'GET' && path === '/v1/maps') {
    const body: MapsListResponse = { maps: deps.listMaps() };
    json(res, 200, body);
    return true;
  }

  // Map detail
  const m = path.match(/^\/v1\/maps\/([^/]+)$/);
  if (method === 'GET' && m) {
    const name = m[1];
    if (!isMapName(name)) {
      json(res, 404, { error: 'unknown_map' });
      return true;
    }
    const detail = deps.getMap(name);
    if (!detail) {
      json(res, 404, { error: 'unknown_map' });
      return true;
    }
    json(res, 200, detail);
    return true;
  }

  // Guest session mint (optional)
  if (path === '/v1/session/guest') {
    if (method !== 'POST') return (methodNotAllowed(res), true);
    if (!deps.mintGuestSession)
      return (json(res, 501, { error: 'not_implemented' }), true);

    const sess = deps.mintGuestSession();
    if (isGuestSessionError(sess)) {
      const status = sess.status ?? 500;
      json(res, status, { error: sess.error });
    } else {
      json(res, 200, sess);
    }
    return true;
  }

  if (method === 'GET' && path === '/v1/session/me') {
    if (!deps.getSessionMe) return (json(res, 501, { error: 'not_implemented' }), true);

    const authHeader = req.headers['authorization'] ?? '';
    if (!authHeader) {
      json(res, 401, { error: 'missing_token' });
      return true;
    }

    const mAuth = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (!mAuth) {
      json(res, 401, { error: 'invalid_auth' });
      return true;
    }

    const token = mAuth[1].trim();
    if (!token) {
      json(res, 401, { error: 'invalid_auth' });
      return true;
    }

    const sess = deps.getSessionMe(token);
    if (isSessionMeError(sess)) {
      json(res, sess.status, { error: sess.error });
    } else {
      json(res, 200, sess);
    }
    return true;
  }

  const worldPlayersMatch = path.match(/^\/v1\/world\/([^/]+)\/players$/);
  if (method === 'GET' && worldPlayersMatch) {
    if (!deps.getWorldPlayers) return (json(res, 501, { error: 'not_implemented' }), true);

    const map = worldPlayersMatch[1];
    if (!isMapName(map)) {
      json(res, 404, { error: 'unknown_map' });
      return true;
    }

    const q: WorldPlayersQuery = {};
    const limitStr = url.searchParams.get('limit');
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) q.limit = limit;
    }

    const result = deps.getWorldPlayers(map, q);
    if (isWorldPlayersError(result)) {
      json(res, result.status, { error: result.error });
    } else {
      json(res, 200, result);
    }
    return true;
  }

  const worldStateMatch = path.match(/^\/v1\/world\/([^/]+)\/state$/);
  if (method === 'GET' && worldStateMatch) {
    if (!deps.getWorldState) return (json(res, 501, { error: 'not_implemented' }), true);
    const map = worldStateMatch[1];
    if (!isMapName(map)) {
      json(res, 404, { error: 'unknown_map' });
      return true;
    }

    const authHeader = req.headers['authorization'] ?? '';
    let token: string | null = null;
    if (authHeader) {
      const mAuth = /^Bearer\s+(.+)$/i.exec(authHeader);
      if (!mAuth || !mAuth[1].trim()) {
        json(res, 401, { error: 'invalid_auth' });
        return true;
      }
      token = mAuth[1].trim();
    }

    const result = deps.getWorldState(map, token);
    if (isWorldStateError(result)) {
      json(res, result.status, { error: result.error });
    } else {
      json(res, 200, result);
    }
    return true;
  }

  // Receipts (read-only audit trail)
  if (method === 'GET' && path === '/v1/receipts') {
    const params: ReceiptsQueryParams = {};

    const player_id = url.searchParams.get('player_id');
    if (player_id) params.player_id = player_id;

    const action = url.searchParams.get('action');
    if (action) params.action = action;

    const since = url.searchParams.get('since');
    if (since) params.since = since;

    const until = url.searchParams.get('until');
    if (until) params.until = until;

    const limitStr = url.searchParams.get('limit');
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) params.limit = Math.min(limit, 1000);
    }

    const offsetStr = url.searchParams.get('offset');
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset) && offset >= 0) params.offset = offset;
    }

    const result = deps.queryReceipts(params);
    json(res, 200, result);
    return true;
  }

  if (method === 'GET' && path === '/v1/receipts/public') {
    if (!deps.queryPublicReceipts) return false;
    const params: PublicReceiptsQueryParams = {};

    const action = url.searchParams.get('action');
    if (action) params.action = action;

    const since = url.searchParams.get('since');
    if (since) params.since = since;

    const limitStr = url.searchParams.get('limit');
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) params.limit = Math.min(limit, 200);
    }

    const offsetStr = url.searchParams.get('offset');
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset) && offset >= 0) params.offset = Math.min(offset, 10_000);
    }

    const result = deps.queryPublicReceipts(params);
    json(res, 200, result);
    return true;
  }

  if (method === 'GET' && path === '/v1/receipts/public_raw') {
    if (!deps.queryPublicReceiptsRaw) return (json(res, 403, { error: 'forbidden' }), true);
    const params: PublicReceiptsQueryParams = {};

    const action = url.searchParams.get('action');
    if (action) params.action = action;

    const since = url.searchParams.get('since');
    if (since) params.since = since;

    const limitStr = url.searchParams.get('limit');
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) params.limit = Math.min(limit, 200);
    }

    const offsetStr = url.searchParams.get('offset');
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset) && offset >= 0) params.offset = Math.min(offset, 10_000);
    }

    const result = deps.queryPublicReceiptsRaw(params);
    if (isPublicReceiptsRawError(result)) {
      json(res, result.status, { error: result.error });
    } else {
      json(res, 200, result);
    }
    return true;
  }

  if (method === 'GET' && path === '/v1/rumors/public') {
    if (!deps.queryPublicRumors) return false;
    const params: PublicRumorsQueryParams = {};

    const since = url.searchParams.get('since');
    if (since) params.since = since;

    const limitStr = url.searchParams.get('limit');
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (!isNaN(limit) && limit > 0) params.limit = Math.min(limit, 200);
    }

    const offsetStr = url.searchParams.get('offset');
    if (offsetStr) {
      const offset = parseInt(offsetStr, 10);
      if (!isNaN(offset) && offset >= 0) params.offset = Math.min(offset, 10_000);
    }

    const result = deps.queryPublicRumors(params);
    json(res, 200, result);
    return true;
  }

  return false;
}
