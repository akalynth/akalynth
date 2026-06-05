# Website Portal Role

Decision: the **website (akalynth-site) is the first account portal**, but it is a
**static frontend with no authority**.

## What the website does

- Title / marketing entry (`index.html`).
- **Create account**, **sign in**, **verify email** (`account.html`).
- **Create character**: choose world, sex, outfit, name.
- **Dashboard**: view account, characters, gold.
- **Houses** (`houses.html`): server-backed view/actions (in-game currency).
- **Shop** (`shop.html`): in-game-currency shop (no real-money payments in V1).

## What the website MUST NOT do

- It does **not own secrets or account authority**. No password hashing, no token
  minting, no economy authority in the browser.
- It **calls `api.akalynth.com`** for all account/character/economy actions; the server
  is the single source of truth.
- It does **not** keep `localStorage` as authority once real-account work begins.
  Today's `localStorage`-only preview (account/shop/houses/app.js) is replaced by real
  API calls; `localStorage` may hold only non-authoritative UI state (e.g. a session
  reference if the chosen session mechanism is a bearer token, handled per the E2 model).

## Boundary discipline

- `akalynth-site` stays the **publication authority** for the marketing/portal site
  (separate repo), served at `akalynth.com`; the **API** is `api.akalynth.com`.
- **Preview wording**: keep "preview"/"pre-alpha" language **only** where behavior is
  still a mock. Once a page is genuinely server-backed, the copy must stop claiming
  preview for that behavior (no overclaiming a live shop/economy that isn't real).
- CORS, CSRF (if cookie sessions), and the exact session mechanism are fixed in the E2 API lane.

## Migration note

The current pages are mockups storing data in the browser. Converting them is a
**behavior change** per page; each conversion is its own reviewable step (E5/E8) and
must preserve a working, honest preview until the server path is live.
