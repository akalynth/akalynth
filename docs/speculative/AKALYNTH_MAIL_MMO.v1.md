# Mail Edge: Golden Receipt

> **Status:** Design doctrine (out of scope for Akalynth v1)
> **Effective:** 2026-01-02
> **Scroll:** `MAIL_EDGE.v1`
> **Change control:** Doctrine. Changes require a version bump of the Scroll and an explicit amendment note (no silent edits).

---

## 1. Doctrine

**Email is transport, not storage. VaultMesh is system-of-record.**

Mail Edge exists to:
1. Accept inbound SMTP traffic
2. Emit outbound SMTP traffic
3. **Emit receipts for every decision**

Mail Edge does NOT:
- Store authoritative mailbox state
- Make policy decisions based on email content
- Execute commands received via email
- Silently delete or lose messages

### The Law

```
Every inbound message → exactly one receipt
Every outbound message → exactly one receipt
Every quarantine/reject → exactly one receipt

No exceptions. No silent drops.
```

---

## 2. Receipt Types (v1 Contract)

| Receipt Kind | Trigger | Required Fields |
|--------------|---------|-----------------|
| `MAIL_INBOUND_ACCEPTED` | Message accepted for delivery | msg_hash, from, to, subject_trunc |
| `MAIL_INBOUND_QUARANTINED` | Message held for review | msg_hash, from, to, quarantine_reason |
| `MAIL_INBOUND_REJECTED_META` | Message rejected (metadata only) | msg_hash, from, to, reject_reason |
| `MAIL_OUTBOUND_SUBMITTED` | Outbound message queued | msg_hash, from, to, queue_id |
| `MAIL_OUTBOUND_ACCEPTED` | Remote MTA accepted | msg_hash, queue_id, remote_mta, smtp_code |
| `MAIL_OUTBOUND_BOUNCE` | Delivery failed permanently | msg_hash, queue_id, bounce_reason, smtp_code |

---

## 3. Canonical Hashing

All receipts reference `msg_hash`:

```
msg_hash = BLAKE3(input RFC822 bytes)
```

Where the input RFC822 bytes are the exact message bytes as received/sent, with:
- No modifications to headers or body
- Original line endings preserved (CRLF)
- No re-encoding

This ensures:
- Hash is reproducible from the artifact
- Hash is stable across systems
- Hash binds receipt to exact bytes

---

## 4. Artifact Bundle Layout

Every message produces an artifact bundle:

```
bundle/{msg_hash}/
├── raw.eml                 # Original RFC822 bytes
├── meta.json               # Extracted metadata (from, to, subject, etc.)
├── normalized.json         # Parsed structure (optional, for search)
└── attachments/            # Detached attachments (if any)
    ├── {blob_hash_1}
    └── {blob_hash_2}
```

Where:
- `{msg_hash}` = BLAKE3 hex of input RFC822 bytes (full hex)
- Attachments are stored by their own BLAKE3 hash

### meta.json Schema

```json
{
  "schema_version": "mail.meta.v1",
  "msg_hash": "blake3:abc123...",
  "msg_id": "<message-id@example.com>",
  "from": "sender@example.com",
  "to": ["recipient@example.com"],
  "cc": [],
  "subject": "Re: Project Update",
  "subject_truncated": false,
  "date": "2026-01-02T10:30:00Z",
  "received_at": "2026-01-02T10:30:05Z",
  "size_bytes": 4096,
  "has_attachments": true,
  "attachment_count": 2,
  "attachments": [
    {
      "filename": "report.pdf",
      "content_type": "application/pdf",
      "size_bytes": 102400,
      "blob_hash": "blake3:def456..."
    }
  ],
  "headers_hash": "blake3:ghi789...",
  "transport": {
    "client_ip": "192.0.2.1",
    "helo": "mail.sender.com",
    "tls": true,
    "tls_version": "TLSv1.3"
  }
}
```

---

## 5. Receipt Format

Receipts follow the existing VaultMesh receipts pipeline (append-only JSONL):

```json
{
  "schema_version": "receipt.v1",
  "kind": "MAIL_INBOUND_ACCEPTED",
  "ts": "2026-01-02T10:30:05Z",
  "msg_hash": "blake3:abc123...",
  "msg_id": "<message-id@example.com>",
  "from": "sender@example.com",
  "to": ["recipient@example.com"],
  "subject_trunc": "Re: Project Upd...",
  "direction": "inbound",
  "bundle_path": "bundle/abc123...",
  "ingest_agent": "vaultmesh-mail-ingest/0.1.0",
  "lane": "default"
}
```

Subject is truncated to 64 characters max (privacy + storage).

Optional fields:
- `override` — boolean, true when a decision override was used.
- `failure` — object with `{ phase, error_code }` for ingest failures or policy rejects.

---

## 6. Quarantine & Rejection

### MAIL_INBOUND_QUARANTINED

```json
{
  "kind": "MAIL_INBOUND_QUARANTINED",
  "msg_hash": "blake3:abc123...",
  "quarantine_reason": "spam_score_high",
  "quarantine_score": 8.5,
  "quarantine_rules": ["BAYES_SPAM", "URIBL_BLOCKED"],
  "review_required": true,
  "auto_release_after": null
}
```

Bundle is written. Message is NOT delivered until explicit release.

### MAIL_INBOUND_REJECTED_META

For rejected messages, we store **metadata only** (no body, no attachments):

```json
{
  "kind": "MAIL_INBOUND_REJECTED_META",
  "msg_hash": "blake3:abc123...",
  "reject_reason": "dkim_fail",
  "reject_stage": "data",
  "smtp_code": 550,
  "smtp_message": "DKIM signature invalid"
}
```

The raw message is NOT stored (rejected = not our problem). But the receipt proves:
- We received something
- We rejected it
- Here's why

---

## 7. Outbound Receipts

### MAIL_OUTBOUND_SUBMITTED

```json
{
  "kind": "MAIL_OUTBOUND_SUBMITTED",
  "msg_hash": "blake3:abc123...",
  "queue_id": "Q123456",
  "from": "user@vaultmesh.example",
  "to": ["external@example.com"],
  "submitted_by": "operator:alice",
  "submitted_via": "api"
}
```

### MAIL_OUTBOUND_ACCEPTED

```json
{
  "kind": "MAIL_OUTBOUND_ACCEPTED",
  "msg_hash": "blake3:abc123...",
  "queue_id": "Q123456",
  "remote_mta": "mx.example.com",
  "remote_ip": "198.51.100.1",
  "smtp_code": 250,
  "smtp_message": "OK"
}
```

### MAIL_OUTBOUND_BOUNCE

```json
{
  "kind": "MAIL_OUTBOUND_BOUNCE",
  "msg_hash": "blake3:abc123...",
  "queue_id": "Q123456",
  "bounce_type": "hard",
  "bounce_reason": "user_unknown",
  "remote_mta": "mx.example.com",
  "smtp_code": 550,
  "smtp_message": "User unknown"
}
```

---

## 8. Policy v1 Decision Matrix

> **Code anchor:** `policy.rs::decide()`

### Inputs

| Field | Source | Type | Description |
|-------|--------|------|-------------|
| `score` | Rspamd/external scanner | `f64?` | Spam/threat score (higher = worse) |
| `tags` | Rspamd/external scanner | `string[]` | Classification tags |
| `auth` | `auth.rs` | `AuthEvidence` | DKIM/SPF/DMARC results (evidence only, v1 does not enforce) |

### Decision Rules (evaluated in order)

| # | Check | Condition | Decision | Evidence Required |
|---|-------|-----------|----------|-------------------|
| 1 | Hard reject tag | Any tag ∈ `hard_reject_tags` (case-insensitive) | `RejectedMeta` | `reject_reason`, `policy.tags` |
| 2 | Missing score | `score == None` or invalid | `RejectedMeta` | `policy.score`, `policy.reason` |
| 3 | Quarantine score | `score >= quarantine_score` | `Quarantined` | `quarantine_reason`, `quarantine_score`, `policy.tags` |
| 4 | Default | All checks pass | `Accepted` | — |

### Default Configuration

```json
{
  "schema_version": "mail-edge-policy/v1",
  "quarantine_score": 5.0,
  "hard_reject_tags": ["malware", "virus", "phish", "blocked"]
}
```

Config path: `$VAULTMESH_ROOT/config/mail_policy.v1.json`

Missing or invalid config is a policy error (fail-closed).

### Determinism Guarantees

1. **Pure function** — `decide()` has no I/O, no RNG, no time dependency
2. **Tag matching** — case-insensitive, trimmed, exact match only
3. **Order independence** — tag order does not affect outcome
4. **Score threshold** — `>=` is inclusive (score of exactly 5.0 quarantines)
5. **Bundle path** — derived from `msg_hash` (content-addressed)

### What v1 Does NOT Enforce

- Size limits (not yet implemented)
- Recipient count limits (not yet implemented)
- DKIM/SPF/DMARC pass/fail (recorded as evidence, not enforced)
- Content inspection (delegated to external scanner)

### Scanner Interface Contract (v1)

#### Purpose

Define how external scanner output becomes `PolicyMeta` evidence. Scanner output is **non-authoritative evidence**; the Mail Edge decision is deterministic given the constructed `PolicyMeta`.

#### Evidence Fields (Input Surface)

Mail Edge constructs `PolicyMeta` from scanner evidence:
- `policy.score: Option<f64>` — optional numeric score
- `policy.tags: Vec<String>` — optional tag list; tags are trimmed and matched case-insensitively by policy
- `policy.reason: Option<String>` — optional human-readable reason; if absent and an internal ingest failure occurs, Mail Edge may set `policy.reason` to an `ingest.*` fingerprint

#### Evidence Source (v1)

Scanner evidence is extracted from SMTP headers (preferred) and/or manual CLI injection:
- Header-derived evidence SHOULD use stable header key families (example families: `X-Rspamd-*`, `X-Spam-*`, `X-VaultMesh-Scan-*`)
- CLI flags map 1:1 to evidence:
  - `--policy-score` → `policy.score`
  - `--policy-tags` → `policy.tags`
  - `--policy-reason` → `policy.reason`

Precedence (v1): **CLI wins over headers** (headers fill gaps only).

#### Minimal Header Mapping (v1)

Supported score headers (first match wins):
- `X-Rspamd-Score: <float> / <float>` (parse the first float)
- `X-Spam-Score: <float>`
- `X-Spam-Level: *****` (score = number of `*`)

Supported tag headers:
- `X-Rspamd-Flag: YES|NO` (if `YES`, add tag `rspamd_spam`)
- `X-Spam-Status: ... tests=TAG1,TAG2,...` (parse `tests=` list into `policy.tags`)

Supported reason header (optional):
- `X-VaultMesh-Scan-Reason: <string>` → `policy.reason` (only if currently unset; implementations MAY truncate)

#### Acquisition Semantics

- Missing scanner evidence (no supported scanner headers present and no CLI inputs): Mail Edge stamps `policy.reason="scanner.missing"`. With fail-closed policy, a missing score yields `RejectedMeta`.
- Timeouts (only relevant if a future HTTP/daemon acquisition mode is enabled): Mail Edge stamps `policy.reason="scanner.timeout"`; missing score still rejects.
- Malformed evidence (unparseable score / tags): ignore malformed fields and set `policy.reason="scanner.malformed"` (or append, if `policy.reason` already exists). If `policy.score` remains empty, decision rejects.
  - If `X-Spam-Status` contains `tests=` but the parsed list is empty, stamp `scanner.malformed`.

When stamping `policy.reason` for acquisition quality, implementations SHOULD only set it if it is currently `None` (to avoid overwriting scanner-provided reasons).

#### Determinism Rule

Once `PolicyMeta` is constructed, the decision is pure/deterministic (`policy.rs::decide()`), and normalization rules (trim + case-insensitive tag matching) apply.

Note: v1 tag normalization uses **ASCII** case-folding (equivalent to `to_ascii_lowercase()`), which is appropriate for scanner tags that are expected to be ASCII.

#### Receipt Binding

Receipts MUST record the exact `PolicyMeta` used (`policy.score`, `policy.tags`, `policy.reason`) so decisions can be explained later without re-running the scanner.

#### Namespaces

- `scanner.*` — evidence acquisition/quality conditions (`scanner.missing`, `scanner.timeout`, `scanner.malformed`, …)
- `ingest.*` — internal ingest failures (`ingest.bundle_write_error:*`, `ingest.emit_receipt_error:*`, `ingest.invalid_args:*`, …)

---

## 9. Invariants (Hard Law)

1. **No silent drops** — every message attempt produces exactly one receipt
2. **Hash binds receipt to artifact** — `msg_hash` is BLAKE3 of exact bytes
3. **Receipts are append-only** — no modification, no deletion
4. **Metadata survives rejection** — rejected messages leave metadata trail
5. **Quarantine is explicit** — held messages have explicit state + reason
6. **Outbound has custody chain** — submitted → accepted/bounced

---

## 10. What This Is NOT

This doctrine explicitly **excludes**:

- **Mailbox semantics** — no folders, no read/unread, no IMAP state
- **Content-based routing** — no "if subject contains X, do Y"
- **Email-as-command** — no "send email to execute@vaultmesh"
- **Email-based identity** — sender address is not authentication
- **Spam scoring as policy** — scores are metadata, not decisions

Mail Edge is a **receipt emitter**, not an email server.

---

## 11. Future Work (Out of Scope for v1)

- DKIM/SPF/DMARC verification receipts
- Quarantine release workflow
- Bounce aggregation + alerting
- Attachment extraction pipeline
- Full-text search indexing

These build ON TOP of the receipt foundation, not instead of it.

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-01-02 | Initial doctrine |
