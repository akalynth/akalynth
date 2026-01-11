import type { MapName } from '@shared/http';

const SERVER_PORT = 3000;

function isLocalHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  );
}

// Translates: <codespace>-5173.app.github.dev -> <codespace>-3000.app.github.dev
// Also handles Gitpod: <workspace>.<port>.*.gitpod.io -> <workspace>.3000.*.gitpod.io
function translateRemoteDevHost(host: string, toPort: number): string | null {
  // Codespaces: <name>-<port>.app.github.dev
  const csMatch = host.match(/^(.*)-(\d+)(\.app\.github\.dev)$/);
  if (csMatch) return `${csMatch[1]}-${toPort}${csMatch[3]}`;

  // Gitpod: <workspace>.<port>.<region>.gitpod.io
  const gpMatch = host.match(/^(.+)\.(\d+)(\..*\.gitpod\.io)$/);
  if (gpMatch) return `${gpMatch[1]}.${toPort}${gpMatch[3]}`;

  return null;
}

const DEFAULT_HTTP = (() => {
  const url = new URL(window.location.href);

  // Local dev: server on :3000
  if (isLocalHost(url.hostname)) {
    return `${url.protocol}//${url.hostname}:${SERVER_PORT}`;
  }

  // Codespaces/Gitpod: rewrite host suffix to server port
  const remoteHost = translateRemoteDevHost(url.hostname, SERVER_PORT);
  if (remoteHost) return `${url.protocol}//${remoteHost}`;

  // Otherwise: same-origin (production behind proxy)
  return window.location.origin;
})();

const DEFAULT_WS = (() => {
  const url = new URL(window.location.href);
  const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';

  // Local dev: ws server on :3000
  if (isLocalHost(url.hostname)) {
    return `${wsProto}//${url.hostname}:${SERVER_PORT}`;
  }

  // Codespaces/Gitpod: rewrite host suffix to server port
  const remoteHost = translateRemoteDevHost(url.hostname, SERVER_PORT);
  if (remoteHost) return `${wsProto}//${remoteHost}`;

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
