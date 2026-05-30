# Apps

Deployable application entrypoints (server, clients, diagnostics). Each app owns
its own `package.json` (or Gradle project), runtime config, build, and packaging.

## Apps

| App | Package name | Description |
|-----|--------------|-------------|
| [`server/`](./server) | `akalynth-server` | Authoritative game server (TypeScript, HTTP + WebSocket). |
| [`debug-client/`](./debug-client) | `akalynth-client` | Debug web client (Vite). |
| [`studio/`](./studio) | `akalynth-studio` | Studio web app (Vite). |
| [`phone-server/`](./phone-server) | `akalynth-phone-server` | Phone/companion server (TypeScript). |
| [`android/`](./android) | (Gradle) | Android client (Kotlin / Jetpack Compose). |

## Conventions

- TypeScript apps use `npm run dev` (watch), `npm run build` (`tsc` / `vite build`),
  and — where present — `npm run start`.
- The Android app is a standalone Gradle project; build it with `./gradlew` from
  `apps/android/` (see [`android/README.md`](./android/README.md)).
- Shared code lives in [`../packages`](../packages); see the root
  [`README.md`](../README.md) and [`docs/README.md`](../docs/README.md) for the
  full dev flow.
