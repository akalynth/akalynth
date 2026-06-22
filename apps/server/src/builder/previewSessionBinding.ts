// Bind active preview world forks to guest tokens for world_state projection.

import type { BuilderPreviewWorldFork } from '../../../../packages/shared/builderDraft.js';
import type { MapName } from '../../../../packages/shared/http.js';

export interface PreviewSessionBinding {
  guest_token: string;
  session_id: string;
  namespace: string;
  fork: BuilderPreviewWorldFork;
}

export class PreviewSessionBindingStore {
  private readonly byGuestToken = new Map<string, PreviewSessionBinding>();
  private readonly guestBySessionId = new Map<string, string>();

  bind(guestToken: string, sessionId: string, fork: BuilderPreviewWorldFork): void {
    const priorSession = this.guestBySessionId.get(sessionId);
    if (priorSession) {
      this.byGuestToken.delete(priorSession);
    }
    const binding: PreviewSessionBinding = {
      guest_token: guestToken,
      session_id: sessionId,
      namespace: fork.namespace,
      fork,
    };
    this.byGuestToken.set(guestToken, binding);
    this.guestBySessionId.set(sessionId, guestToken);
  }

  unbindBySession(sessionId: string): void {
    const guestToken = this.guestBySessionId.get(sessionId);
    if (!guestToken) return;
    this.byGuestToken.delete(guestToken);
    this.guestBySessionId.delete(sessionId);
  }

  getByGuestToken(guestToken: string): BuilderPreviewWorldFork | undefined {
    return this.byGuestToken.get(guestToken)?.fork;
  }

  getBindingByGuestToken(guestToken: string): PreviewSessionBinding | undefined {
    return this.byGuestToken.get(guestToken);
  }

  getBindingBySession(sessionId: string): PreviewSessionBinding | undefined {
    const guestToken = this.guestBySessionId.get(sessionId);
    if (!guestToken) return undefined;
    return this.byGuestToken.get(guestToken);
  }
}

export function builderPreviewForMap(
  guestToken: string | null,
  map: MapName,
  bindings: PreviewSessionBindingStore,
): BuilderPreviewWorldFork | undefined {
  if (!guestToken) return undefined;
  const fork = bindings.getByGuestToken(guestToken);
  if (!fork || fork.map_name !== map) return undefined;
  return fork;
}