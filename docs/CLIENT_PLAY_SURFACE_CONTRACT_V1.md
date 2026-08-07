# Client Play Surface Contract v1

**Status:** APPROVED for beta (2026-08-07)  
**Surfaces:** browser `https://beta.akalynth.com/play/` and direct Android beta APK  
**Wire protocol:** still governed by [`CLIENT_CONTRACT_V0_1.md`](./CLIENT_CONTRACT_V0_1.md) (HTTP/WS authority)  
**Publish ladder:** [`runbooks/beta-client-publish-ladder-v1.md`](./runbooks/beta-client-publish-ladder-v1.md)

This document freezes **player-facing behavior** both clients must honor so switching
web ↔ APK is not a different game. It does not establish world canon or change G1–G15.

---

## 1. Authority rules (non-negotiable)

| Rule | Requirement |
|------|-------------|
| Intent only | Clients send intents (`move_intent`, gather/refine/deliver, chat, …). Never invent position, HP, inventory, or loot as truth. |
| Server wins | Snapshots, receipts, and `death_notice` are authoritative. UI reflects them. |
| Same API/WS | Beta HTTP/WS bases per `CLIENT_CONTRACT_V0_1`. No client-private economy shortcuts. |

---

## 2. Locked play UX (must match)

### 2.1 Movement

| Item | Contract |
|------|----------|
| Pad layout | Cardinal **N / W / E / S** on the play HUD |
| Stop | **Center stop control** (`■` / a11y **Stop movement**) clears held movement so motion does not stick |
| Hold-to-repeat | Holding a direction repeats move intents while pressed |
| Diagonals | **Not required** on the play HUD for parity. Web may still expose diagonal buttons; wire mapping remains server cardinals only |
| Forbidden | Floating / absolute-positioned second stop (legacy `.dpad-stop` / ✕) |

**Android play path:** `apps/android/.../ui/components/DPad.kt` (WorldScreen).  
**Web play path:** `apps/debug-client/src/components/DPad.tsx` (center grid cell only).

### 2.2 Death

| Item | Contract |
|------|----------|
| On `death_notice` | Show a **death toast** within a short window |
| Toast interaction | Tap → **death recap** (killer/zone/items when provided) |
| Dismiss | Clears pending notice; does not invent respawn authority |
| Forbidden | Silent status flip only with no player-facing feedback |

### 2.3 Gather / chill zone (when flags enable content)

| Item | Contract |
|------|----------|
| Intents | `gather_intent` / `refine_intent` / `deliver_intent` with server node/station ids |
| Buttons | Show gather / refine / deliver when in range of nearest valid target |
| Map markers | **Web may show M/R/C overlays**; Android may use nearest-only buttons. Both must complete the same loop. Full marker parity is **P1**, not blocking this contract |
| Forbidden | Client-side “success” without server result messages |

### 2.4 Chrome / inventory (player primary)

| Item | Contract |
|------|----------|
| Primary inventory affordance | **Hotbar slots** with real item icons when assets exist |
| Drop confirm | Long-press / confirm tiers for drop (Android tiers; web pack sheet equivalent for drop) |
| Web-only operator tools | Builder, Proof, FairPlay (if unwired), presentation customize — **must not** be required to finish core loops |

### 2.5 Chat, Tem, chronicle

| Item | Contract |
|------|----------|
| Chat | Send/receive chat intents; sheets/overlays must not block movement permanently |
| Tem / witness | Modal challenge + respond; do not drop the session silently |
| Chronicle | Openable sheet; death row may deep-link to recap when id present |

---

## 3. Explicit non-goals (do not claim parity)

- F-Droid channel identity (held; separate signer authority)
- Full backpack / house storage UI on Android
- Shared-world / caravan observation message types on Android
- Ground-item map loot UX on Android
- 8-direction pad as a ship requirement
- Production (`api.akalynth.com`) client line

---

## 4. Version and distribution contract (Android direct beta)

| Field | Rule |
|-------|------|
| `versionCode` | Monotonic integer; live ladder uses `YYYYMMDDNN` (see `AKALYNTH_ANDROID_BETA_LONG_VERSION_V1`) |
| `versionName` | `0.Y.Z-beta.YYYYMMDDNN-<tag>` matching published APK |
| APK name | `akalynth-beta-v{versionCode}.apk` (immutable basename) |
| Manifest | `infra/android/beta-client-update.json` **must match** live `/v1/client/android-update?lane=beta` after publish |
| Self-update | Client must install only when remote `version_code` **>** installed `versionCode` and SHA matches |

**Current live ladder (as of 2026-08-07 deploy):** `version_code = 2026080702`.

Never publish a lower `versionCode` than live. Never leave `main` at an ancient code while live runs a long-date ladder.

---

## 5. Git / branch contract

| Line | Role |
|------|------|
| **`main`** | Canonical integrate target. After this unify PR, **must** carry live chrome + publish ladder |
| `agent/ui-chrome-art-perf-lane` | Historical art/chrome lane; fold into main, do not invent a third long-lived client fork |
| `deploy/*` | Short-lived publish branches; delete after merge to main |

**Rule:** The next beta client ship is built from **`main` at a named SHA**, not from an orphan worktree, unless an emergency hotfix is explicitly authorized and then back-merged the same day.

---

## 6. Verification gate (before claiming “clients match”)

1. `npm -w apps/debug-client run build` — PASS; bundle has **zero** `dpad-stop`  
2. `./gradlew :app:assembleBeta` (or `assembleBeta`) — PASS  
3. Live: `curl -sfS https://beta-api.akalynth.com/v1/client/android-update?lane=beta` matches repo manifest  
4. Live `/play/` assets match freshly built hashes (or documented publish receipt)  
5. Manual smoke both surfaces: move → stop → (optional gather) → death toast path  

---

## 7. Amendment

Bump to **v1.1** only with an explicit decision note. Do not silently reintroduce dual stop controls, versionCode regression, or a second client branch as the ship source.
