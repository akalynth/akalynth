// Bind active preview world forks to guest tokens for world_state projection.
export class PreviewSessionBindingStore {
    byGuestToken = new Map();
    guestBySessionId = new Map();
    bind(guestToken, sessionId, fork) {
        const priorSession = this.guestBySessionId.get(sessionId);
        if (priorSession) {
            this.byGuestToken.delete(priorSession);
        }
        const binding = {
            guest_token: guestToken,
            session_id: sessionId,
            namespace: fork.namespace,
            fork,
        };
        this.byGuestToken.set(guestToken, binding);
        this.guestBySessionId.set(sessionId, guestToken);
    }
    unbindBySession(sessionId) {
        const guestToken = this.guestBySessionId.get(sessionId);
        if (!guestToken)
            return;
        this.byGuestToken.delete(guestToken);
        this.guestBySessionId.delete(sessionId);
    }
    getByGuestToken(guestToken) {
        return this.byGuestToken.get(guestToken)?.fork;
    }
    getBindingByGuestToken(guestToken) {
        return this.byGuestToken.get(guestToken);
    }
    getBindingBySession(sessionId) {
        const guestToken = this.guestBySessionId.get(sessionId);
        if (!guestToken)
            return undefined;
        return this.byGuestToken.get(guestToken);
    }
}
export function builderPreviewForMap(guestToken, map, bindings) {
    if (!guestToken)
        return undefined;
    const fork = bindings.getByGuestToken(guestToken);
    if (!fork || fork.map_name !== map)
        return undefined;
    return fork;
}
