---
name: debug-client
description: Use when developing, debugging, or extending the Akalynth browser debug client (apps/debug-client/) — React/TypeScript app covering WebSocket connection, map rendering, actions panel, chat, event log, presence, and existence mode.
version: 0.1.0
---

# Debug Client

The debug client (`apps/debug-client/`) is the browser-based development and verification tool for the Akalynth game server. It is not a player-facing app — it is an authoritative test surface.

## Key files

- `apps/debug-client/src/App.tsx` — root, mode and connection orchestration
- `apps/debug-client/src/hooks/useGameClient.ts` — WebSocket lifecycle, message dispatch
- `apps/debug-client/src/useExistenceMode.ts` — existence mode state
- `apps/debug-client/src/config.ts` — server URL and connection config
- `apps/debug-client/src/types.ts` — shared client-side types
- `apps/debug-client/src/components/ActionsPanel.tsx` — action dispatch UI
- `apps/debug-client/src/components/MapCanvas.tsx` — tile map renderer
- `apps/debug-client/src/components/ChatSheet.tsx` — chat panel
- `apps/debug-client/src/components/EventLog.tsx` — raw event stream
- `apps/debug-client/src/components/ExistenceShell.tsx` — presence container
- `apps/debug-client/src/components/NearbyList.tsx` — nearby entity list
- `apps/debug-client/src/components/PresenceList.tsx` — connected player list
- `apps/debug-client/src/components/TopBar.tsx` — connection status bar

## Rules

- The debug client sends intent only. Never derive position or state from client-side calculation and report it as truth.
- Changes to message shape must be coordinated with `protocol-guardian` and `packages/shared/`.
- Component changes that affect action dispatch must be verified against the server handler, not just the UI.
- Do not add auth bypass, admin shortcuts, or client-side cheat helpers — even for debug builds.

## Build and verify

- Build: `npm -w apps/debug-client run build`
- Dev server: `npm -w apps/debug-client run dev`
- After any WS message change, also run: `npm run build:packages` and `./scripts/verify_protocol_sync.sh`

## Output should include

- Files changed.
- Protocol impact (additive / compatible / breaking).
- Component and hook changes.
- Verification command and result.
