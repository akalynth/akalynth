# Identity Verification v0.1

External verification protocol for Akalynth identity tokens.

---

## Purpose

This document specifies how a third party verifies an Akalynth identity token without server access. Verification requires only:

1. The token string
2. The public key (from `/v1/transparency`)
3. The receipt chain (optional, for binding verification)

---

## Key Derivation

The auth signing key is **derived** from the chronicle key. The chronicle key itself is never used directly for token signing.

### Derivation Formula

```
auth_seed = BLAKE3("akalynth/auth/v0" || chronicle_key_bytes)
```

Where:
- `||` denotes byte concatenation
- `chronicle_key_bytes` is the 32-byte raw chronicle signing seed
- Output is a 32-byte Ed25519 seed

### Derivation Properties

| Property | Value |
|----------|-------|
| Hash function | BLAKE3 |
| Domain separator | `akalynth/auth/v0` (UTF-8 bytes) |
| Input | 32-byte chronicle seed |
| Output | 32-byte auth seed |
| Key type | Ed25519 |

The domain separator ensures:
1. Auth keys cannot be confused with chronicle signing keys
2. Future auth versions can use different separators (e.g., `akalynth/auth/v1`)
3. Keys from other systems with the same seed produce different auth keys

---

## Token Wire Format

```
base64url(payload_json) + "." + base64url(ed25519_signature)
```

### Components

| Component | Encoding | Content |
|-----------|----------|---------|
| Payload | Base64URL | UTF-8 JSON object |
| Separator | Literal | `.` (ASCII 46) |
| Signature | Base64URL | 64-byte Ed25519 signature |

### Payload Schema

```json
{
  "token_id": "blake3:abc123...",
  "player_id": "p_abc123",
  "issued_at": 1705849200000,
  "expires_at": 1705852800000,
  "nonce": "abc123def456789a"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token_id` | string | Content-addressed token identifier (see computation below) |
| `player_id` | string | Canonical player identifier (prefix: `p_`) |
| `issued_at` | integer | Unix epoch milliseconds when token was issued |
| `expires_at` | integer | Unix epoch milliseconds when token expires |
| `nonce` | string | 16-byte hex string (32 hex characters) |

### Token ID Computation

```
token_id = "blake3:" + hex(BLAKE3("akalynth/token_id/v0" || player_id || issued_at || nonce))
```

Where:
- `player_id` is UTF-8 encoded
- `issued_at` is the decimal string representation of the epoch milliseconds (UTF-8)
- `nonce` is the raw hex string (UTF-8, not decoded)
- All components are concatenated as bytes without separators

Example:
```
domain = "akalynth/token_id/v0"  // 20 bytes
player_id = "p_abc123"           // 9 bytes
issued_at = "1705849200000"      // 13 bytes
nonce = "abc123def456789a"       // 16 bytes

preimage = domain || player_id || issued_at || nonce  // 58 bytes
token_id = "blake3:" + hex(BLAKE3(preimage))
```

---

## Verification Steps

### Step 1: Parse Token Wire Format

Locate the only `.` separator.

```
dot = token.indexOf(".")
if dot <= 0 or dot != token.lastIndexOf(".") or dot == token.length - 1:
    reject("malformed_token")

payload_b64 = token.slice(0, dot)
signature_b64 = token.slice(dot + 1)
```

Validation:
- Token MUST contain exactly one `.`
- Both parts MUST be non-empty
- Both parts MUST be valid Base64URL

### Step 2: Decode Payload

```
payload_json = base64url_decode(payload_b64)
payload = JSON.parse(payload_json)
```

Validation:
- Payload MUST be valid UTF-8
- Payload MUST parse as JSON object
- All required fields MUST be present

### Step 3: Verify Signature

```
message = payload_b64  // Sign the encoded payload, not decoded JSON
signature = base64url_decode(signature_b64)
valid = ed25519_verify(auth_public_key, message, signature)
```

The signature covers the Base64URL-encoded payload bytes, not the decoded JSON. This ensures the exact wire encoding is authenticated.

Validation:
- Signature MUST be exactly 64 bytes
- `ed25519_verify` MUST return true

### Legacy Compatibility (Transition)

Tokens issued before wire-authenticated signing used a signature over canonical
JSON bytes (sorted keys). During the transition, verifiers MAY attempt canonical
JSON verification if payload_b64 verification fails.

### Step 4: Check Expiration

```
now = current_unix_epoch_ms()
if payload.expires_at <= now:
    reject("token_expired")
```

### Step 5: Enforce Maximum TTL

```
MAX_TOKEN_TTL_MS = 86400000  // 24 hours

ttl = payload.expires_at - payload.issued_at
if ttl > MAX_TOKEN_TTL_MS:
    reject("ttl_exceeded")
```

This policy prevents long-lived tokens even if the server issues them.

### Step 6: Verify Token ID

Recompute the token ID and compare:

```
expected_id = compute_token_id(payload.player_id, payload.issued_at, payload.nonce)
if payload.token_id != expected_id:
    reject("token_id_mismatch")
```

This confirms the token ID is content-addressed and not fabricated.

### Step 7: (Optional) Bind to Receipt Chain

If verifying against the receipt chain, locate the `auth_token_issue` receipt by
matching `inputs.token_id`:

```
receipt = find_receipt(
  action="auth_token_issue",
  inputs.token_id=payload.token_id
)
```

Note: `token_id` is a hash of token content, not a receipt hash. Index by
`inputs.token_id` or scan receipts to find the matching issuance.

Validate the receipt binds the same fields:

```
assert receipt.action == "auth_token_issue"
assert receipt.inputs.player_id == payload.player_id
assert receipt.inputs.issued_at == payload.issued_at
assert receipt.inputs.nonce == payload.nonce
assert receipt.inputs.expires_at == payload.expires_at
```

The receipt provides:
- Proof the server actually issued this token
- Timestamp ordering in the chain
- Chain integrity via `prev_hash` linkage

---

## Transparency Endpoint

### Contract

```
GET /v1/transparency
```

### Response Schema

```json
{
  "version": "0.1.0",
  "server_version": "0.1.0",
  "identity": {
    "auth_public_key_hex": "abc123...",
    "key_derivation": "blake3(akalynth/auth/v0 || chronicle_seed)"
  },
  "principles": [
    "Money cannot buy gameplay power",
    "Every state change is receipted",
    "Receipts are cryptographically signed and chain-linked",
    "Enforcement is deterministic and replayable"
  ],
  "documentation": {
    "monetization_constitution": "/docs/MONETIZATION_CONSTITUTION.md",
    "architecture": "/docs/ARCHITECTURE.md",
    "anticheat": "/docs/ANTICHEAT.md"
  },
  "public_receipts_endpoint": "/v1/receipts/public",
  "verification": {
    "chain_integrity": "npm run verify:lifecycle",
    "monetization_policy": "npm run verify:monetization",
    "work_contracts": "npm run verify:work-contracts"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Server version string (legacy) |
| `server_version` | string | Server version string |
| `identity.auth_public_key_hex` | string | 32-byte Ed25519 public key, hex-encoded (64 characters) |
| `identity.key_derivation` | string | Human-readable derivation description |
| `principles` | string[] | Transparency principles |
| `documentation.*` | string | Documentation paths |
| `public_receipts_endpoint` | string | Public receipts feed path |
| `verification.*` | string | Verification script hints |

### Caching

The public key is derived from the chronicle key and does not change during server lifetime. Verifiers MAY cache this response.

### Security Considerations

- The endpoint exposes only the **public** key
- The derivation description is informational; verifiers need not parse it
- HTTPS is required in production

---

## Pseudocode Reference

Language-agnostic verification implementation:

```
function verify_token(token_string, auth_public_key_hex):
    // Step 1: Parse
    dot = index_of(token_string, ".")
    if dot <= 0 or dot != last_index_of(token_string, ".") or dot == length(token_string) - 1:
        return error("malformed_token")

    payload_b64 = slice(token_string, 0, dot)
    signature_b64 = slice(token_string, dot + 1)

    // Step 2: Decode
    try:
        payload_json = base64url_decode(payload_b64)
        payload = json_parse(payload_json)
    catch:
        return error("invalid_payload")

    // Validate required fields
    required = ["token_id", "player_id", "issued_at", "expires_at", "nonce"]
    for field in required:
        if field not in payload:
            return error("missing_field: " + field)

    // Step 3: Verify signature
    auth_public_key = hex_decode(auth_public_key_hex)
    signature = base64url_decode(signature_b64)
    message = utf8_encode(payload_b64)

    if not ed25519_verify(auth_public_key, message, signature):
        // Optional legacy fallback (canonical JSON signature)
        canonical_payload = canonical_json(payload)
        legacy_message = utf8_encode(canonical_payload)
        if not ed25519_verify(auth_public_key, legacy_message, signature):
            return error("invalid_signature")

    // Step 4: Check expiration
    now_ms = current_unix_epoch_ms()
    if payload.expires_at <= now_ms:
        return error("token_expired")

    // Step 5: Enforce max TTL
    MAX_TTL_MS = 86400000  // 24 hours
    ttl = payload.expires_at - payload.issued_at
    if ttl > MAX_TTL_MS:
        return error("ttl_exceeded")

    // Step 6: Verify token ID
    expected_id = blake3_hex(
        "akalynth/token_id/v0" +
        payload.player_id +
        string(payload.issued_at) +
        payload.nonce
    )
    if payload.token_id != "blake3:" + expected_id:
        return error("token_id_mismatch")

    // Success
    return {
        ok: true,
        player_id: payload.player_id,
        issued_at: payload.issued_at,
        expires_at: payload.expires_at
    }


function blake3_hex(input):
    return hex_encode(blake3(utf8_encode(input)))


function canonical_json(value):
    return json_stringify_sorted_keys(value)


function compute_token_id(player_id, issued_at, nonce):
    preimage = "akalynth/token_id/v0" + player_id + string(issued_at) + nonce
    return "blake3:" + blake3_hex(preimage)
```

---

## Receipt Binding

When the server issues a token, it emits an `auth_token_issue` receipt:

```json
{
  "sequence": 1234,
  "timestamp": "2025-01-21T10:00:00.000Z",
  "prev_hash": "blake3:abc...",
  "event_hash": "blake3:def...",
  "signature": "...",
  "actor_id": "system",
  "action": "auth_token_issue",
  "inputs": {
    "player_id": "p_abc123",
    "issued_at": 1705849200000,
    "expires_at": 1705852800000,
    "nonce": "abc123def456789a",
    "token_id": "blake3:..."
  },
  "result": "ok",
  "inputs_hash": "blake3:...",
  "outputs_hash": "blake3:..."
}
```

### Binding Verification

A verifier with access to `receipts.jsonl` can confirm:

1. **Existence**: The token was actually issued by the server
2. **Ordering**: When it was issued relative to other events
3. **Integrity**: The receipt chain is unbroken (via `prev_hash`)
4. **Consistency**: Receipt fields match token payload exactly

This binding is optional for basic token verification but provides stronger assurance for audit scenarios.

---

## Offline Verification

A third party can verify tokens completely offline with:

| Requirement | Source |
|-------------|--------|
| Token string | From player/client |
| Auth public key | Previously fetched from `/v1/transparency` |
| Receipt chain | Previously exported `receipts.jsonl` (optional) |

No network access required after initial key fetch.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `malformed_token` | Token does not contain exactly one `.` separator |
| `invalid_payload` | Payload is not valid Base64URL or JSON |
| `missing_field` | Required payload field is absent |
| `invalid_signature` | Ed25519 signature verification failed |
| `token_expired` | `expires_at` is in the past |
| `ttl_exceeded` | Token lifetime exceeds 24-hour policy |
| `token_id_mismatch` | Computed token ID does not match payload |
| `receipt_not_found` | No matching `auth_token_issue` receipt (binding verification only) |
| `receipt_field_mismatch` | Receipt fields do not match token payload |

---

## Security Properties

### Guaranteed

| Property | Mechanism |
|----------|-----------|
| Authenticity | Ed25519 signature over payload |
| Integrity | Any payload modification invalidates signature |
| Non-repudiation | Server cannot deny issuing a token with receipt binding |
| Content addressing | Token ID is hash of content, not arbitrary identifier |
| TTL enforcement | Client-side policy caps token lifetime |

### Not Guaranteed

| Property | Reason |
|----------|--------|
| Revocation | No revocation list; tokens valid until expiry |
| Freshness | Replay within TTL window is possible |
| Key rotation | Public key changes require verifier update |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-01-21 | Initial specification |

---

## References

- `packages/coordination-kernel/src/receipt/hasher.ts` - BLAKE3 and Ed25519 utilities
- `packages/coordination-kernel/src/receipt/key.ts` - Key loading and derivation
- `packages/coordination-kernel/examples/REGULATOR_VERIFICATION.md` - Receipt chain verification
- `docs/PROTOCOL.md` - WebSocket message reference
