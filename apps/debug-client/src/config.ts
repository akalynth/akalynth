import type { MapName } from '@shared/http';

const DEFAULT_HTTP = window.location.origin.replace(/^ws/, 'http');
const DEFAULT_WS = (() => {
  if (window.location.protocol === 'https:') return `wss://${window.location.host}`;
  return `ws://${window.location.host}`;
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
