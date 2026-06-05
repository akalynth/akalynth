# Moderation And Reporting Impact

Status: research only. No implementation.

## Current Moderation Model

Current reporting is metadata-first:

- `skill_report` reports an online target.
- Report receipt action is `player_reported`.
- Report inputs include reporter ID, target ID, target name, case ID, and timestamp.
- Moderation table stores report metadata and receipt hash.
- Admin moderation list/resolve handlers are DEBUG-gated.
- There is no message excerpt, message receipt hash, plaintext disclosure, ciphertext, sender device ID, or reporter signature in the report flow.

Evidence:

- `apps/server/src/skills/handlers.ts:105`
- `apps/server/src/persist/schema.ts:152`
- `apps/server/src/moderation/index.ts:67`
- `packages/shared/protocol.ts:774`

## Why Current Chat Being Plaintext Matters

Current plaintext chat gives the server and private receipt chain enough body evidence to inspect after the fact, assuming appropriate operator tooling and access. Chronicle stores a hash and length, but audit receipts store plaintext `inputs.message`.

If chat bodies are E2EE, the server can no longer independently inspect message content. A moderation case can only evaluate:

- Metadata.
- Rate/frequency.
- Sender/recipient IDs.
- Conversation membership.
- Participant-provided disclosure.
- Device/key evidence, if implemented.

## Participant-Supplied Reports For E2EE

An encrypted-message report would need the reporting client to submit a disclosure bundle containing:

- Conversation ID.
- Sender player ID.
- Sender device ID.
- Recipient player ID/device ID.
- Key epoch or session ID.
- Message nonce/counter.
- Ciphertext.
- Plaintext disclosed by reporter.
- Associated data used during encryption.
- Signature or transcript proof, if the sender signs message envelopes.
- Receipt hash or delivery metadata receipt proving the ciphertext passed through the server.

The server must treat this as participant-supplied evidence, not as independently observed truth.

## Moderation Risks Introduced By E2EE

- False reports become easier if plaintext disclosure is not cryptographically bound to ciphertext.
- Abuse detection loses body-level signals.
- Moderators cannot search private messages.
- Harassment evidence depends on victim-side retention.
- Deleted/lost local keys can make reports impossible.
- Multi-device inconsistencies can create gaps.
- If reports reveal plaintext, the privacy story becomes "private unless reported by a participant."

## V1 Moderation Recommendation

Do not encrypt current world/local chat in V1.

Before E2EE whispers:

- Add a report schema that can reference a specific message/delivery receipt.
- Add participant disclosure format.
- Define moderator authority and privacy boundaries.
- Decide whether reported plaintext becomes a private receipt, redacted receipt, or separate evidence artifact.
- Add tests for tampered disclosure, missing ciphertext, wrong sender, wrong device, and wrong key epoch.

## What Must Remain Visible

Even with E2EE, moderation and abuse systems should retain:

- Sender and recipient IDs.
- Conversation ID.
- Timestamps.
- Delivery status.
- Message length or ciphertext length.
- Key epoch/session ID.
- Report case ID.
- Reporter and target IDs.
- Rate-limit counters.
- Block/mute/report events.
