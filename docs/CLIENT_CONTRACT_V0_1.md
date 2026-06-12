# Client Contract v0.1 (Frozen)

This contract is frozen for Android/client wire compatibility.
Server may evolve internally, but MUST remain backward compatible with this contract until a new contract is minted.

## Environments

| Environment | HTTP Base | WS Base |
|---|---|---|
| beta | `http://beta-api.akalynth.com` | `ws://beta-api.akalynth.com` |
| prod (reserved) | `https://api.akalynth.com` | `wss://api.akalynth.com` |
| local dev (emulator) | `http://10.0.2.2:3000` | `ws://10.0.2.2:3000` |

## Endpoints

### Health
- `GET /v1/health`
- Response:
```json
{"ok":true,"version":"0.1.0","tick_ms":100,"now_iso":"2026-01-20T22:43:54.479Z"}
```

### Character Create
- Retired: `POST /v1/characters/create`
- Current: `POST /v1/characters` with account session cookie, double-submit CSRF, verified email, `world_id`, `sex`, and `outfit_id`
- Request:
```json
{"name":"Sovereign","world_id":"rookguard","sex":"male","outfit_id":"male_wanderer"}
```
- Success (201):
```json
{
  "ok": true,
  "character": {
    "character_id": "p_abc123",
    "name": "Sovereign",
    "world_id": "rookguard",
    "sex": "male",
    "outfit_id": "male_wanderer",
    "created_at": "2026-06-12T00:00:00.000Z"
  },
  "token": "<SIGNED_TOKEN>",
  "expires_at": 1705852800000
}
```
- Errors:
  - 400 `invalid_input` - Name, world, sex, or outfit violates account-character rules
  - 401 `not_authenticated` - Account session cookie is missing or invalid
  - 403 `csrf_failed` - Server received a request without matching CSRF header/cookie
  - client-side `csrf_missing` - Client has a session cookie but no readable CSRF token and must ask the user to sign in again before sending create/select
  - 403 `email_unverified` - Account email must be verified before creating a new character
  - 409 `name_taken` - Name already in use
  - 409 `character_limit` - Account already has the maximum number of characters
  - 429 `rate_limited` - Too many attempts
  - 403 `banned` - Account banned (reserved)

Error response body (all non-200):
```json
{"ok":false,"error":"invalid_input"}
```

## WebSocket

### Connection
- Client opens WebSocket to the configured WS Base.
- No special headers required; use the scheme from the environment table.

### First Server Message (immediate)
```json
{"type":"welcome","version":"0.1.0"}
```

### Login

**Message (client → server)**

Client MUST send login after welcome.

```json
{
  "type":"login",
  "token":"<SIGNED_TOKEN>",
  "guest_token":null
}
```

Rules:
- `token` is OPTIONAL (new signed auth token)
- `guest_token` is OPTIONAL (legacy)
- If both present, server SHOULD prefer `token`

**Server Responses**

login_ack (success):
```json
{
  "type":"login_ack",
  "ok": true,
  "player_id": "p_abc123",
  "name": "Sovereign",
  "token": "<SIGNED_TOKEN>",
  "expires_at": 1705852800000
}
```

Notes:
- Server MAY rotate tokens and return a fresh token in login_ack
- Client SHOULD persist returned token and use it for future sessions
- `guest_token` field is deprecated; use `token` for new implementations

error (failure):
```json
{
  "type":"error",
  "code":"token_invalid",
  "message":"Invalid token"
}
```

### Enter World

**enter_world (client → server)**
```json
{"type":"enter_world"}
```

**world_state (server → client)**
```json
{
  "type":"world_state",
  "map":"Rookguard",
  "player":{"id":"p_abc123","x":32,"y":32,"name":"Sovereign","status":"alive"},
  "nearby_players":[]
}
```

**inventory_snapshot (server → client)**
```json
{
  "type":"inventory_snapshot",
  "items":[]
}
```

## Required Client Messages (MVP)

| Message | When | Shape |
|---------|------|-------|
| `login` | after welcome | `{"type":"login","token":"..."}` or `{"type":"login","guest_token":null}` |
| `enter_world` | after login_ack | `{"type":"enter_world"}` |
| `move_intent` | to move | `{"type":"move_intent","direction":"north"}` |
| `chat` | to chat | `{"type":"chat","message":"Hello"}` |

## Expected Server Messages (MVP)

| Message | When | Key Fields |
|---------|------|------------|
| `welcome` | on connect | `version` |
| `login_ack` | after login | `ok`, `player_id`, `name`, `token`, `expires_at` |
| `world_state` | after enter_world | `map`, `player`, `nearby_players` |
| `inventory_snapshot` | after enter_world | `items[]` |
| `move_result` | after move_intent | `ok`, `x`, `y`, `reason` |
| `player_moved` | broadcast | `player_id`, `x`, `y` |
| `player_joined` | broadcast | player object |
| `player_left` | broadcast | `player_id` |
| `chat_broadcast` | broadcast | `player_id`, `name`, `message` |
| `error` | on error | `code`, `message` |

## Error Codes

| Code | Meaning |
|------|---------|
| `invalid_message` | Malformed or unknown message |
| `not_authenticated` | Action requires login |
| `token_invalid` | Token fails signature/format validation |
| `token_expired` | Token expired |
| `banned` | Account banned (reserved) |
| `csrf_failed` | Server-side CSRF double-submit check failed |
| `csrf_missing` | Client-side guard: account session cookie exists but readable CSRF token is missing |
| `email_unverified` | Account email must be verified before character create |
| `not_in_world` | Action requires being in world |
| `rate_limited` | Too many requests |
| `kicked` | Server kicked player |
| `name_taken` | Character name already in use |
| `character_limit` | Account has reached the character limit |
| `invalid_input` | Character name/world/sex/outfit violates rules |

## Name Rules (Character Create)
- Length: 3–20 chars
- Pattern: `^[A-Za-z][A-Za-z0-9_-]{2,19}$`
- Reserved list is server-configurable (must include at least: `Guest_*`, `Admin`, `System`, `Sovereign`)

## Direction Values
`"north"` | `"south"` | `"east"` | `"west"`

## Token Format

Tokens are Ed25519 signed, stateless authentication credentials.

Wire format:
```
base64url(payload_json) + "." + base64url(ed25519_signature)
```

Payload fields:
- `token_id`: Content-addressed identifier (blake3 hash)
- `player_id`: Player identifier
- `issued_at`: Epoch ms when issued
- `expires_at`: Epoch ms when expires
- `nonce`: 16-byte hex for determinism

Default TTL: 1 hour
Maximum TTL: 24 hours (server-enforced)

See `docs/IDENTITY_VERIFICATION.md` for verification protocol.

## Migration Notes (v0 → v0.1)

### What's New
- Retired `POST /v1/characters/create` endpoint for persistent named characters
- Current account-gated `POST /v1/characters` endpoint for world/sex/outfit character creation
- Signed auth tokens (preferred over guest tokens)
- New error codes: `token_invalid`, `token_expired`, `name_taken`, `invalid_input`, `character_limit`, `csrf_failed`, `csrf_missing`, `email_unverified`, `banned`
- `login_ack` now includes `token` and `expires_at` fields

### Backward Compatibility
- `guest_token` login remains a legacy WebSocket compatibility path where the
  server still accepts it.
- Existing clients can upgrade gradually, but account-character create/select
  clients must use the account session + CSRF HTTP flow.
- Guest compatibility does not create account characters, ownership, or durable
  gameplay authority.

### Recommended Migration
1. Sign in or create an account and keep the account session cookie.
2. Preserve the readable CSRF token returned by account login.
3. Load `GET /v1/worlds` and `GET /v1/outfits`, then create with
   `POST /v1/characters` using `name`, `world_id`, `sex`, and `outfit_id`.
4. Store the returned play token persistently.
5. Send `{"type":"login","token":"..."}` on reconnect.
6. Handle `not_authenticated`, `csrf_failed`, client-side `csrf_missing`,
   `email_unverified`, `invalid_input`, `name_taken`, and `character_limit`
   gracefully.
