# Account · Character · World Model

The relational/ownership model that E1/E4 implement. No schema DDL here — this fixes
the *shape* and lifecycle so the API and receipts are consistent.

## Entities & relationships

```
account (1) ──< character (N) ── world_id
                       │
                       ├── sex        : 'male' | 'female'        (chosen at first sign-in)
                       └── outfit_id  : reference to an outfit catalog entry
```

- An **account** owns zero-or-more **characters**.
- Each **character** is bound to exactly one **world** at creation (world choice).
- Each **character** has a **sex** and an **outfit_id** chosen during creation
  (first sign-in requires sex + outfit before entering the game).
- The existing **signed character token** (Ed25519, the in-game play credential)
  remains the *play* credential; under this model a character token is **issued to an
  authenticated account session**, binding character → account.

## Identifiers

- `account_id` — stable, opaque, non-PII (never the email).
- `character_id` — stable, opaque (the existing `p_<uuid>` player id may serve).
- `world_id` — from a server-owned world catalog (e.g. `rookguard`, `azura`).
- `outfit_id` — from a server-owned outfit catalog (see appearance below).

## Worlds

- A **server-owned catalog** of worlds is the source of truth (`GET /v1/worlds`).
- Initial worlds derive from the current map set (Rookguard / Azura); the catalog
  decouples "world" from the hard-coded `MapName` so worlds can be added/retired.

## Appearance (sex + outfit)

- **Sex**: `male | female`, chosen first.
- **Outfit**: chosen from `GET /v1/outfits` filtered by sex. V1 uses **discrete full
  sprites** (one finished sprite per sex×outfit), per the product decision.
- The chosen `outfit_id` maps to a sprite the game client renders (via the existing
  character-sprite system / `characterSpriteOverrides`).
- Outfit catalog is **server-owned** so web, Android, and game client agree on options.

## Character creation flow (account-gated)

1. Account is authenticated (signed in) and `email_verified`.
2. Choose **world**.
3. Choose **sex**.
4. Choose **outfit** (filtered by sex).
5. Choose **name** (validated by existing rules: 3–20, starts with a letter,
   `[A-Za-z0-9_-]`, not reserved, not taken).
6. Server creates the character, binds it to the account + world + sex + outfit, and
   issues the play token for that character session.

## Proposed API surface (specified in E4)

```
GET  /v1/worlds                     -> world catalog
GET  /v1/outfits?sex=male|female    -> outfit catalog
GET  /v1/characters                 -> account's characters (auth required)
POST /v1/characters                 -> create {name, world_id, sex, outfit_id} (auth required)
POST /v1/characters/select          -> select active character -> play token
```

Note: `POST /v1/characters/create` (the current name-only, guest-era endpoint) is
**superseded** by the account-gated `POST /v1/characters`. The legacy endpoint may stay
during migration but is not the production path.

## Lifecycle receipts (privacy-bounded)

`character_created`, `character_selected`, `character_world_assigned`,
`character_outfit_selected` — carrying stable IDs + linkage only, never PII.
See [RECEIPT_PRIVACY_BOUNDARY.md](./RECEIPT_PRIVACY_BOUNDARY.md).

## Relationship to #148 (web token login)

#148 added in-client character-create + signed-token login/rotation as a **stopgap**.
Under this model, **real creation moves to the account-gated flow** (web/Android);
the game client authenticates with the account/character session and plays. #148's
token store/rotation logic is reused for the play credential.
