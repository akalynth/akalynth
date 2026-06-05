# Encryption Model Matrix

Status: research only. No implementation.

Scale: low / medium / high / very high.

| Model | Money cost | CPU/runtime cost | Storage cost | Protocol complexity | Android complexity | Server complexity | Moderation impact | Receipt/proof impact | Recovery impact | Release-readiness risk | V1 classification |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. TLS-protected transport with server-readable chat | Low | Low | None | Low | Low | Low | Keeps server moderation visibility | No receipt schema change | None | Low | Feasible transport posture; not app-level chat encryption |
| 2. Server-readable chat with encrypted-at-rest storage | Medium | Medium | Medium | Medium | Low-medium | High | Server can moderate if decrypt path exists, but ops key custody becomes sensitive | Changes receipt meaning if plaintext removed; requires receipt encryption policy | Server key recovery required | High | Not recommended for V1 |
| 3. E2EE 1:1 whispers | Medium | Low-medium per message | Medium | High | High | Medium-high metadata broker | Server cannot moderate body unless participant reports | Receipts prove encrypted delivery metadata, not plaintext meaning | Lost device loses history unless backup exists | High | Candidate; blocked pending key/report/protocol design |
| 4. E2EE party/group chat | Medium-high | Medium | High | Very high | Very high | High | Server cannot moderate body; membership churn hard | Requires group key epochs and membership proofs | Lost key/group rekey complexity | Very high | Not recommended for V1 |
| 5. E2EE world chat | High | High at scale | High | Very high | Very high | Very high | Incompatible with public/world moderation expectations | Hard to prove useful content; high metadata leak anyway | Unmanageable for public surface | Very high | Not recommended for V1 |

## Model Notes

### 1. TLS-protected transport with server-readable chat

Current architecture already targets this transport posture. TLS protects network transport while preserving server authority, moderation, Tem, tutorial, receipts, and anti-abuse. TLS is not application-level chat encryption and is not chat E2EE.

Feasible V1 transport posture.

### 2. Server-readable chat with encrypted-at-rest storage

This sounds simpler than E2EE but is risky in this repo because receipts are the canonical evidence. If `inputs.message` becomes encrypted, replay and moderation change. If plaintext remains elsewhere, the privacy claim is weak. If the server holds decryption keys, key custody and operator access policy become part of the threat model.

Not recommended for V1 unless the project first designs retention and receipt redaction.

### 3. E2EE 1:1 whispers

Best future candidate because whispers can be separated from gameplay. The server can broker ciphertext and metadata without interpreting content. It still requires device key identity, participant verification, lost-key policy, and report disclosure.

Candidate only after preconditions are named and tested; blocked pending key/report/protocol design.

### 4. E2EE party/group chat

Group membership, rekeying, removed members, multi-device, and history access all raise complexity sharply. It should wait until 1:1 encrypted whispers are proven.

Not recommended for V1.

### 5. E2EE world chat

World chat is a public gameplay surface. Encrypting it end-to-end conflicts with moderation, abuse handling, tutorial/Tem semantics, and server-authoritative design. It also leaks most useful metadata while removing body visibility from moderation.

Not recommended for V1.
