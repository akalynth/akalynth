---
name: protocol-guardian
description: Use when changing Akalynth WebSocket messages, HTTP APIs, shared protocol/types, Android/debug-client contracts, or docs that define client-server compatibility.
---

# Protocol Guardian

Protect compatibility across server, shared packages, debug client, and Android.

Workflow:

1. Read `packages/shared/protocol.ts`, `packages/shared/http.ts`, relevant server handlers, and `docs/PROTOCOL.md`.
2. Classify the change as additive, compatible, or breaking.
3. Update shared types before endpoint or message handling code.
4. Keep clients intent-only. Do not accept client coordinates or client-side truth claims.
5. Include compatibility notes for every message/API/shared-type change.
6. Run protocol sync and the narrow build/test path that matches the change.

Required note format:

- Contract touched.
- Compatibility impact.
- Client action required.
- Verification command/output.

