# Codespaces / Devcontainer Setup

This devcontainer provides Node 20, Java 17, and optional Android SDK bootstrap.

## Quick Start

1. Open in Codespaces or local devcontainer
2. Run `cd apps/server && npm run dev`
3. Run `cd apps/debug-client && npm run dev`
4. Open the forwarded port 5173 in browser

## Port Forwarding

| Service | Port | Description |
|---------|------|-------------|
| Server  | 3000 | HTTP + WebSocket |
| Client  | 5173 | Vite dev server |
| Preview | 4173 | Vite preview (production build) |

The client auto-detects Codespaces hostnames and rewrites WebSocket URLs:
- `*-5173.app.github.dev` → `*-3000.app.github.dev`

## Troubleshooting

### HMR (Hot Module Reload) not working

If the app loads but hot reload fails (console shows WebSocket errors to port 5173, mixed content warnings, or close code 1006):

Add to `apps/debug-client/vite.config.ts`:

```typescript
server: {
  // ... existing config
  hmr: {
    protocol: 'wss',
    clientPort: 443,
  },
},
```

This tells Vite's HMR to use the Codespaces HTTPS proxy instead of direct connection.

### WebSocket connection fails

If the client can't connect to the server:

1. Ensure server port 3000 is forwarded and set to **Public** visibility
2. Check browser console for the WebSocket URL being used
3. Override manually if needed: create `apps/debug-client/.env.local`:
   ```
   VITE_WS_BASE=wss://<your-codespace>-3000.app.github.dev
   ```

### Android SDK

The Android SDK is not installed by default. Run:
```bash
bash .devcontainer/postCreateCommand.sh
```
to bootstrap it (downloads ~2GB).
