import type { MapName } from '@shared/http';

const DEFAULT_HTTP = (() => {
  const url = new URL(window.location.href);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Local dev: server separate on :3000
  if (isLocal) return `${url.protocol}//${url.hostname}:3000`;

  // Otherwise: same-origin
  return window.location.origin;
})();

const DEFAULT_WS = (() => {
  const url = new URL(window.location.href);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';

  // Local dev: ws server on :3000
  if (isLocal) return `${wsProto}//${url.hostname}:3000`;

  // Otherwise: same-origin
  return `${wsProto}//${url.host}`;
})();

export interface ClientConfig {
  httpBase: string;
  wsBase: string;
  defaultMap: MapName;
}

export function loadConfig(): ClientConfig {
  const httpBase = import.meta.env.VITE_HTTP_BASE || DEFAULT_HTTP;
  const wsBase = import.meta.env.VITE_WS_BASE || DEFAULT_WS;
  const defaultMap: MapName = (import.meta.env.VITE_DEFAULT_MAP as MapName) || 'Rookguard';
  return { httpBase, wsBase, defaultMap };
}
