# AKALYNTH_STRANGER_PILOT_RELEASE_MANIFEST_BINDING_V1

Status: accepted implementation decision

Authority: project-owner authorization in the active Codex thread on
2026-08-12: `Approve release-manifest binding repair.`

Effective schema target: v27

Stage boundary: controlled playable pre-alpha only

## Decision effect

This decision authorizes the bounded source repair needed to bind a beta cohort
to one canonical multi-artifact release identity and one rollback identity. It
does not authorize deployment, installation of a live manifest, database
migration on a live host, cohort creation or activation, invite issuance,
participant recruitment, a credentialed live smoke, or a release claim.

The earlier Stranger Pilot Admission Gate remains `NO-GO` until this source is
reviewed, merged, separately deployed, and the remaining gate conditions are
proved against one frozen release.

## Schema and admission invariant

Schema v27 adds these nullable columns to `beta_cohorts`:

- `release_manifest_sha256`;
- `rollback_manifest_sha256`.

They remain nullable only so schema-v26 rows migrate without deletion or
invented provenance. Every new cohort must store both lowercase SHA-256
digests. A missing or malformed digest is fail-closed at every admission edge:

- an unbound cohort cannot transition to `open`;
- an unbound cohort cannot issue a new invite;
- an invite belonging to an unbound cohort cannot be redeemed.

Opening, issuing, and redemption also require the cohort release digest to
equal the active release digest. A bound-but-stale cohort is admission-inert.

`release_commit` and `rollback_commit` remain compatibility fields identifying
the backend commits. They no longer claim to identify the portal, `/play/`,
policy, routing, or Android artifacts.

## Canonical manifest contract

The manifest schema id is `akalynth.beta_release_manifest.v1`. The digest is
SHA-256 over UTF-8 canonical JSON using lexicographically sorted object keys and
no insignificant whitespace. Array order, when present in future compatible
schemas, remains significant. The v1 parser rejects unknown keys and requires:

- manifest id, UTC generation time, and cohort platform;
- backend full commit and `BUILD_INFO.json` SHA-256;
- portal full commit and hashes for `index.html`, `account.html`,
  `register.html`, `forgot.html`, `beta.html`, `js/app.js`, and
  `css/style.css`;
- `/play/` source commit and hashes for `index.html`, at least one emitted
  JavaScript asset, and at least one emitted CSS asset;
- the four beta/chill-zone policy booleans;
- Caddy configuration SHA-256, beta static root, and API upstream;
- for Android or mixed cohorts, Android source commit, version code/name, APK
  SHA-256, and byte size. Android identity is optional for a web-only cohort.

The operator create path requires all of:

```text
--release <full-backend-commit>
--rollback <full-backend-commit>
--release-manifest <candidate-release.json>
--rollback-manifest <candidate-rollback.json>
--active-manifest <separately-installed-active-release.json>
--backend-build-info <served-BUILD_INFO.json>
--portal-root <served-portal-root>
--play-root <served-play-root>
--caddy-config <active-Caddyfile>
```

The CLI parses and canonicalizes every file, recomputes every digest, requires
the active manifest digest to equal the proposed release digest, and requires
backend commits and platforms to match the compatibility arguments. Any parse,
schema, digest, commit, platform, or active-state mismatch aborts before cohort
insertion.

Creation also hashes the served `BUILD_INFO.json`, every declared portal and
`/play/` file, and the active Caddy configuration directly from the supplied
live paths. It verifies the parsed build commit and, when Android identity is
present, requires and hashes the APK and checks its byte size. A missing file or
byte drift aborts before the database is opened, so a failed preflight cannot
migrate or insert into the cohort ledger.

`--active-manifest` is an input from the separately authorized release lane. It
must identify the exact served state and remain outside a developer-writable
source checkout under operator custody. This source decision does not install
or bless such a file.

The release lane must retain the exact release and rollback JSON artifacts in
root-custodied publish evidence. A ledger digest without its immutable manifest
preimage is not sufficient rollback or audit evidence.

## Evidence projections

The manifest digest is additive evidence:

- `GET /v1/beta/me` returns both release and rollback digests on the cohort;
- invite-issued and invite-redeemed receipts include the release digest;
- authenticated readiness and feedback receipts include the bound release
  digest, or `null` when no cohort is associated;
- readiness reports include both digests.

The receipt chain stays append-only and canonical. No existing receipt is
rewritten. SQLite remains the operational admission ledger rather than
receipt-derived gameplay truth.

## Compatibility

This is an additive HTTP change. Existing clients may ignore the new fields.
There is no WebSocket message or payload change and no WebSocket protocol
version bump. Schema-v26 rows are preserved, but admission is intentionally
stricter until they are explicitly bound through a separately reviewed repair.

## Verification gate

Before merge or deployment, prove:

1. fresh, v24, both historical v25 shapes, combined v25, and canonical v26
   converge to v27 without row loss;
2. repeated v27 initialization is idempotent;
3. canonical JSON is order/whitespace independent and rejects unknown shape;
4. CLI creation persists both digests only when active and proposed release
   manifests match;
5. unbound open/issue/redeem paths fail closed;
6. HTTP, receipt, report, debug-client, and protocol-sync compatibility passes.

Passing these source gates does not change the Stranger Pilot Admission Gate to
`GO`. Deployment, immutable manifest production, credentialed live smoke,
receipt-head capture, cohort activation, invitations, and recruitment remain
separate decisions.
