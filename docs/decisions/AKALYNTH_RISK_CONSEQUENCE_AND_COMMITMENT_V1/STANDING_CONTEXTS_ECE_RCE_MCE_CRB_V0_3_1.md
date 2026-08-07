# Standing Contexts + ECE/RCE/MCE + CRB v0.3.1

Status: **accepted design contract**

Decision record:
[`DECISION.md`](./DECISION.md)

Authority boundary: this contract specifies the acceptance and evidence
machinery for the Risk & Consequence Spine. It does not amend Civil Guarantees
G1–G15, expand V1, establish world canon, or authorize implementation.

## 1. Purpose and governing invariant

The artifacts are combined because separating intent acceptance from canonical
resolution would recreate ambiguity about which event owns the outcome.

| Artifact | Role |
| --- | --- |
| Standing exposure context | Long-lived, receipt-backed risk context that may source many exposure episodes. |
| Exposure Commitment Envelope (ECE) | Immutable, server-owned acceptance of one subject-scoped consequence-capable episode. |
| Recovery Commitment Envelope (RCE) | Immutable commitment to recover sealed recoverable consequence line items. |
| Remediation Commitment Envelope (MCE) | Immutable, authority-bounded commitment to compensate a committed root after fault or authorized correction. |
| Consequence Receipt Bundle (CRB) | One episode's canonical root, ordered effect evidence, and seal. |

Every CRB has exactly one prior immutable commitment envelope. Every terminal
envelope has exactly one root and one seal. No accepted envelope silently
disappears or reopens.

An integrity fault is evidence and a trigger. It is never remediation authority
by itself. Every MCE requires the authority defined in this contract.

## 2. Object graph

```text
standing_exposure_context  (0..N overlapping per subject)
  └── 0..N ECE

sealed recoverable consequence line
  └── 0..N RCE

authorized decision or preauthorized remediation policy
  + integrity-fault or target evidence
  + committed target root/effect references
    └── 0..N MCE

accepted envelope (ECE | RCE | MCE) → 0..1 root
terminal envelope                   → exactly 1 root + exactly 1 seal
root                                → exactly 1 commitment envelope

coupled_interaction_plan
  → ordered 2..N ECEs
    → one atomic member-root batch
      → N member bundle seals
        → exactly 1 interaction_seal
```

| Rule | Requirement |
| --- | --- |
| RCE parentage | Sealed recoverable line items, never standing exposure context. |
| MCE parentage | Mandatory authority plus committed target and fault/effect evidence, never standing exposure context. |
| Root parent | Exactly one ECE, RCE, or MCE. |
| Terminal outcomes | `resolved`, `no_consequence`, `aborted`, `authorized_neutralized`, or `resolution_invalid`. |
| Protection recommitment blockers | Relevant non-terminal ECEs or active contested standing contexts only. |
| Non-blockers | RCEs, MCEs, and unrelated historical episodes. |

## 3. Standing exposure contexts

Standing contexts are created by sources such as:

- contested-zone entry;
- war membership;
- carrying exposed power; and
- another separately approved standing-risk source.

They are not consequence episodes and never substitute for an ECE.

### 3.1 Context identity and lifecycle

Each context has:

- a server-generated `standing_exposure_context_id`;
- a `subject_id`;
- a typed source;
- an append-only revision sequence; and
- `opened`, `revised`, and `closed` receipts.

Each effective revision binds:

- disclosure artifact and policy revision;
- disclosed aggregate ceiling;
- protection state disclosed;
- acceptance mode;
- acceptance-evidence receipt; and
- effective chain boundary.

No new ECE may reference a context revision closed before ECE acceptance.
Closure after ECE acceptance never rewrites the envelope.

### 3.2 Overlapping-context composition

ECEs bind the ordered set:

```text
standing_context_revision_refs[]
```

The server binds the complete active set; the client cannot omit an unfavorable
context.

A pinned composition policy defines:

- precedence;
- deduplication;
- conflict handling;
- consequence-class composition; and
- the aggregate ceiling across active contexts.

A pure-victim ECE cannot exceed the effective previously accepted composed
ceiling. Missing or insufficient disclosure closes the episode as
`no_consequence` or `resolution_invalid`.

A material risk increase cannot silently revise an occupied context. It
requires a disclosed egress-only boundary before effect. During that boundary,
the player may leave but cannot project contested power while indefinitely
withholding acceptance.

## 4. Subject binding and multi-subject interactions

An ECE is not created on every contested-zone tick.

The server creates a subject ECE when a typed resolver durably binds that
subject into a specific consequence-capable resolution set, before outcome
computation.

For a multi-subject interaction:

- one `interaction_id` is shared;
- each subject receives one ECE/CRB pair;
- subject ordering is canonical; and
- protection, ceiling, sanctuary eligibility, policy, and pre-state remain
  independent per subject.

The resolver declares one atomicity mode:

| Mode | Rule |
| --- | --- |
| `independent` | Each subject may commit independently. Partial commitment is accepted behavior and restart resumes remaining subjects. |
| `coupled` | Membership and the union write set are frozen; all member roots share one atomic durability boundary. |

Conserved custody, territory transfer, shared-objective resolution, and other
cross-subject conserved state require coupled mode.

## 5. Shared immutable envelope base

Acceptance becomes authoritative only when the envelope's acceptance receipt is
durably appended.

Every envelope binds:

- a server-issued envelope identity;
- `subject_id`;
- a required `server_acceptance_key`;
- `canonical_acceptance_hash`;
- policy ID and content hash;
- an envelope receipt ID;
- acceptance timestamp, as an ordering aid only; and
- an optional, untrusted `client_correlation_key`.

The client correlation key is lookup metadata and never establishes canonical
uniqueness.

The accepted envelope body never changes. Lifecycle is reconstructed from
append-only receipts. Emergency handling never rewrites the envelope or policy
pin.

### 5.1 Append-time logical uniqueness

| Artifact | Logical key |
| --- | --- |
| Envelope | `server_acceptance_key` |
| Root | `envelope_id` |
| Child | `root_id + ordinal` |
| Bundle seal | `root_id` |
| Coupled interaction plan | `interaction_plan:{interaction_id}` |
| Coupled root batch | `root_batch:{interaction_id}` |
| Coupled interaction seal | `interaction_seal:{interaction_id}` |

The durable append is the logical linearization point. The same key with
identical logical content returns the existing receipt. The same key with
different content is an integrity fault. Concurrent writers cannot append two
authoritative records for one logical key.

## 6. Exposure Commitment Envelope

An ECE binds at acceptance:

| Field | Requirement |
| --- | --- |
| `exposure_id` | Server-issued authoritative identity. |
| `subject_id` | Subject whose consequence is resolved. |
| `initiator_ref` | Optional typed player, organization, world, or system cause. |
| `standing_context_revision_refs[]` | Exact active context revisions, if any. |
| `interaction_id` | Shared interaction identity where applicable. |
| `acceptance_source` | Typed source of the consequence-capable bind. |
| `risk_declaration_hash` | Content address of the effective disclosure artifact. |
| `policy_id` and content hash | Pinned forever for this envelope. |
| `protection_commitment` | `null` or one item plus its commitment receipt reference. |
| `aggregate_ceiling` | Structured ceiling across consequence classes. |
| `material_context_fingerprint` | Accept-time material context. |
| Shared-base fields | Acceptance and uniqueness fields from section 5. |

A material context change before acceptance rejects the bind. Later material
state is handled through the durable resolution basis; it never mutates the
accepted ECE.

### 6.1 Protection recommitment

A protection change:

- resolves only through committed rest state outside contested exposure;
- never alters an accepted ECE;
- produces a canonical receipt;
- has nonzero friction; and
- affects future ECEs only.

Normative race ordering:

| First durable boundary | Result |
| --- | --- |
| Hostile ECE acceptance | The old protection pin survives to the ECE's deterministic boundary. |
| Sanctuary or rest commit | Later hostile admission rejects and recommitment may proceed. |

RCEs and MCEs do not independently block recommitment. Repeated attack attempts
cannot continually reset a pending sanctuary/rest boundary. Every accepted ECE
has a server-only terminal path requiring no attacker cooperation.

## 7. Recovery Commitment Envelope

An RCE has:

- a new `recovery_episode_id`;
- the shared immutable envelope fields;
- hard links to one original root and specific sealed recoverable line items;
- its own policy ID and content hash;
- a typed recovery route;
- `recovery_allocation_accounting`;
- mandatory `compensation_of` references; and
- allocation claims described below.

An RCE never appends post-hoc recovery children to the original CRB. The
original consequence remains immutable.

### 7.1 Reservation ledger

Each recoverable line is receipt-derived:

```text
recoverable_total
  → reserved
    → consumed | released
```

RCE acceptance atomically reserves allocation through a receipt. Only the
subject or an explicit mutual contract may reserve. Allies, custodians, and
markets cannot involuntarily block recovery or the non-monopolizable
minimum-agency floor.

Same-item recovery uses an exclusive identity claim, not a scalar budget.

Every RCE pins a deterministic terminal boundary. Disconnect, retries, or
counterparty silence cannot extend it.

At RCE root append:

```text
reserved = consumed + released
```

No residual allocation is permitted.

| Outcome | Reservation disposition |
| --- | --- |
| `resolved` | Consume the committed recovery and release any remainder. |
| `aborted`, `no_consequence`, `authorized_neutralized`, `resolution_invalid`, or expiry | Release all. |

Expiry triggers an empty root and seal; it is never an implicit mutation. Root
append authoritatively dispositions the reservation. Seal gates projection
only.

A contested recovery route may create a separate ECE. The RCE never shields
that new exposure.

## 8. Remediation Commitment Envelope

An MCE is a bounded post-root correction path. It is never a player recovery
shortcut and never receives authority merely because a fault was observed.

Every MCE requires:

| Requirement | Binding |
| --- | --- |
| Initiator | Server or authorized authority only. |
| Authority | Explicit decision receipt or preauthorized remediation-policy reference. |
| Trigger/evidence | Integrity-fault or other authorized correction evidence. |
| Key | Unique correction `server_acceptance_key`. |
| Body | Authority, reason, scope, target root, fault, and effect references. |
| Policy | Pinned remediation-policy ID and content hash. |
| Claims | Canonical `read_set` and `write_set`. |
| Accounting | `remediation_accounting` bounded to the exact compensable delta. |

An MCE may not:

- rewrite, reseal, or rehash the target root;
- create a new adverse consequence;
- substitute for missing target evidence;
- bypass an unsealed target; or
- create net remediation beyond the compensable delta.

A new adverse consequence requires a newly disclosed ECE.

If the target is unsealed, mechanical projection remains quarantined until the
target evidence completes. The MCE cannot make an incomplete target complete.

| Timing | Path |
| --- | --- |
| Before target root | Decision receipt, then an empty `authorized_neutralized` root and empty seal on the original ECE; no MCE. |
| After target root | MCE, remediation root, and seal; the original root remains untouched. |

Every accepted MCE has a server-only terminal path.

## 9. Durable resolution basis

Before outcome computation, the episode durably binds:

| Basis element | Purpose |
| --- | --- |
| Canonical pre-state or chain-head reference | Replay and audit identity. |
| Standing-context revision references | Exact context freeze. |
| Typed resolution trigger | Why the episode exists. |
| Server-time boundary | Determinism where time is mechanically relevant. |
| Policy and disclosure artifacts | Exact retained rules and player-facing ceiling. |
| RNG commitment, seed reference, and retained opening | Deterministic selection and external explanation where randomness applies. |
| `read_set[]` | Entity reference plus expected committed revision. |
| Proposed `write_set[]` | Entity reference, operation or claim, and resulting revision. |

Without a complete basis, the server cannot claim the same outcome on retry.
It must revalidate and close the original episode explicitly as `aborted`,
`resolution_invalid`, or another allowed empty outcome. It never silently
resolves the same envelope under a new basis.

## 10. Root and effect manifest

The resolution root is the sole authoritative outcome commit.

At durable append, the root contains:

- envelope reference;
- pinned policy reference;
- complete ordered `effect_manifest[]`;
- authoritative outcome;
- causal-input references;
- canonical `read_set` validation;
- committed `write_set` claims; and
- content and receipt-chain hashes required by the canonical ledger.

Each manifest entry contains:

| Field | Requirement |
| --- | --- |
| Logical effect ID | Stable within the episode. |
| Ordinal | Dense deterministic order. |
| Consequence class | Body, Item, Reputation, Place, Faction/Organization, or World. |
| Typed payload | Complete payload or a permanent content-addressed reference. |
| Descriptor hash | Hash of the logical effect descriptor. |
| Accounting | ECE ceiling, RCE allocation, or MCE remediation accounting as appropriate. |
| Compensation reference | Mandatory for recovery and remediation effects. |

The root manifest is immutable. It is never filled or rewritten after append.

Before root append:

- all semantic validation completes;
- ECE effects fit the disclosed aggregate ceiling;
- RCE effects fit reserved allocation;
- MCE effects fit the compensable delta;
- payload references are durably stored and hash-verified; and
- the server atomically validates the read set and claims the write set against
  canonical committed receipts, including unsealed roots.

A conflict closes the envelope with an empty `resolution_invalid` root under
the original basis. It never silently clamps or recomputes.

Clamp behavior is valid only when it is a disclosed operation in the pinned
policy and occurs during normal pre-root resolution.

A post-root accounting breach is an integrity fault. Projection is quarantined
and any mechanical correction uses append-only remediation; the root is never
altered.

## 11. Child evidence and bundle seal

Each child receipt references:

- `root_id`;
- manifest ordinal;
- logical effect ID;
- descriptor hash; and
- the typed effect evidence.

Physical interleaving with other episodes is allowed. Causality comes from
explicit references, not adjacency or timestamps.

The bundle seal:

- lists actual child receipt hashes in manifest order;
- proves complete manifest expansion;
- cannot create, alter, or cancel the root outcome; and
- gates projection.

Completeness is derived from the seal's presence, never a mutable flag. Empty
manifests still require an empty seal.

An unsealed root:

- remains authoritative;
- participates in read/write conflict checks;
- holds affected subjects and claimed resources at a deterministic
  server-owned boundary;
- never expires or rolls back; and
- resumes child expansion from the first missing ordinal after restart.

The same logical child key with identical content returns the existing receipt.
Different content is a fatal integrity conflict.

## 12. Coupled interaction commit

The immutable `coupled_interaction_plan` binds:

- `interaction_id`;
- ordered member ECE identities;
- member subjects;
- member bases;
- the union read/write set;
- cross-subject invariants; and
- mode `coupled`.

The member-root batch:

- validates the frozen union read/write set once;
- commits all member roots at one all-or-none durable boundary; and
- exposes no partial authoritative member-root subset.

Any pre-root membership, basis, disclosure, or union-write failure closes every
accepted member with empty `resolution_invalid` roots in the same atomic unit.

Each member root expands and receives its own bundle seal. The
`interaction_seal` then references:

- immutable plan hash;
- ordered member root hashes;
- ordered member seal hashes; and
- union write-set resulting revisions.

The interaction seal proves completeness only and cannot mutate outcomes.

No coupled member state, delivery, or Chronicle materializes before every member
bundle and the interaction are sealed. Restart resumes evidence completion
without re-resolution.

Unsealed write claims are exclusive outside their coupled batch. They do not
expire or roll back.

## 13. Projection ordering and replay

```text
standing contexts + typed trigger
  → durable acceptance receipt
    → immutable ECE | RCE | MCE
      → durable resolution basis
        → compute and validate
          → fsynced root
            → ordered child evidence
              → bundle seal
                → coupled interaction seal, when applicable
                  → atomic derived-state materialization
                    → Chronicle
                      → client delivery
                        → analytics
```

Projection is logically all-or-none for the applicable root or coupled
interaction. Receipt replay reconstructs the same state without re-running live
resolution, randomness, schedulers, or player intent.

Failure behavior:

| Failure point | Required result |
| --- | --- |
| Before durable envelope acceptance | No envelope exists. |
| After acceptance, before root | Resume from the same basis or close explicitly; never silently rebind. |
| After root, before child completion | Existing root remains authoritative; append only missing declared evidence. |
| After bundle seal, before projection/delivery | Replay the sealed outcome once. |
| Duplicate delivery | Return the existing outcome; create no effect. |

Disconnect is transport loss, not a gameplay action. Voluntary logout succeeds
only at a server-resolved safe boundary.

## 14. Evidence audiences and artifact retention

Audience tags classify evidence; they never grant access. Authorization is
enforced at the projection or query boundary.

| Audience | Typical projection |
| --- | --- |
| Subject | Own disclosure, acknowledgment, outcome, recovery options, and receipt references. |
| Authorized audit | Full envelope/bundle chain, policy artifacts, authority, remediation, and lever activations. |
| Public Chronicle | Delayed, redacted, allowlisted civil record. |
| Operations | Scoped lever and integrity evidence only. |

Canonical receipts may contain restricted mechanical evidence but never
credentials, tokens, signing keys, or operational secrets.

The following are retained with every referencing historical episode:

- policy bodies and content hashes;
- disclosure artifacts;
- resolution-basis evidence;
- content-addressed effect payloads;
- RNG commitments and audit openings;
- authority and lever receipts; and
- envelope, root, child, and seal receipts.

A permanent hash without retrievable evidence does not satisfy external
auditability.

Chronicle is a projection and never a source of mechanical truth.

## 15. Forward-only operational levers

All lever activations are durably receipted before effect and identify
authority, reason, scope, effective chain boundary, review/expiry condition, and
old/new policy hashes where applicable.

| Lever | Effect |
| --- | --- |
| Consequence-family suspension | Prospective only; never suppresses required receipts. |
| Exposure admission cap | Limits new ECE admission; cannot create untargetability through self-fill. |
| Recovery relief | Adds or improves minimum-agency RCE paths; never erases residue or restores contested assets for free. |
| Policy supersession / reactivation | Applies to new envelopes only unless an explicit authorized path closes an unresolved episode. |
| Integrity admission suspension | Repeated integrity conflicts may prospectively suspend the implicated resolver/policy. |

Existing roots remain untouched. Reservations release only through receipts.

## 16. Mastery and abuse

Sanctioned mastery includes:

- timing before durable acceptance;
- positioning and escape;
- lawful protection recommitment;
- information asymmetry;
- landing a legitimate hostile bind before the committed cutoff; and
- social or political leverage.

Never-sanctioned abuse includes:

- receipt races;
- duplicate-key manipulation;
- recovery-reservation grief;
- incomplete-bundle manipulation;
- spam-maintained exposure or rest-boundary reset;
- untyped remediation;
- coupled-batch games;
- kill trading;
- alt laundering; and
- collusive recovery.

## 17. Health gates

Spine-level health includes:

- disclosure and acknowledgment coverage;
- post-loss re-exposure;
- recovery completion;
- time to minimum agency;
- repeat-victim concentration;
- power concentration and contestability;
- relief utilization and suspected laundering; and
- reviewed exploit incidence.

Package-level health includes:

- orphaned envelopes;
- root-to-seal latency;
- episodes and resources held at integrity boundaries;
- append-key and logical-content conflicts;
- child descriptor conflicts;
- committed write-set conflicts;
- disclosure-composition conflicts;
- multi-subject closure skew;
- incomplete coupled-interaction age;
- recovery over-allocation attempts;
- recovery-reservation dwell;
- terminal reservation residual rate, which must be zero;
- MCE volume and rejection reasons; and
- remediation-delta overshoot attempts.

Loss comprehension remains a playtest/research measure, not a receipt-derived
claim. Numeric thresholds and observation windows are deferred.

## 18. Conformance gate

Before any release or implementation-conformance claim, verification must
cover at least:

### Standing context and acceptance

- standing context without ECE produces no consequence;
- typed resolver binds ECE before computation;
- pure-victim ceiling never exceeds composed disclosed ceiling;
- missing or stale disclosure closes without adverse effect;
- material risk increase waits for the disclosed egress boundary;
- overlapping-context composition and context close/bind races;
- server acceptance-key replay and body mismatch; and
- client correlation never establishes authority.

### Protection, sanctuary, and lifecycle

- protection recommit races;
- hostile-first versus rest-first ordering;
- attack spam cannot reset a pending rest boundary;
- sanctuary entry during hostile exposure;
- disconnect after acceptance;
- restart during resolution; and
- voluntary logout only at a safe boundary.

### Root, child, seal, and replay

- root without complete manifest rejects;
- crash before root commits no consequence;
- crash after root resumes missing child ordinals without recomputation;
- seal cannot alter root outcome;
- duplicate children and delivery create no duplicate effect;
- unsealed root conflicts on its write set;
- logical child content drift produces an integrity fault; and
- evidence references remain retrievable and hash-valid.

### Coupled interactions

- member plan freezes membership and union write set;
- crash before or after atomic member-root durability;
- pre-root failure closes all accepted members atomically invalid;
- no member projection before all member seals and interaction seal;
- interaction-seal mismatch cannot alter outcomes; and
- conserved custody remains exactly conserved.

### Recovery

- recovery uses a new RCE and leaves the original root unchanged;
- RCE reservation accepts atomically;
- same-item recovery uses an exclusive identity claim;
- over-allocation and unauthorized reservation reject;
- expiry and disconnect close through exactly one root;
- every terminal RCE satisfies `reserved = consumed + released`; and
- minimum-agency recovery remains non-monopolizable.

### Remediation

- MCE without authority rejects;
- integrity fault alone cannot authorize MCE;
- correction-key replay is idempotent;
- excess remediation delta rejects;
- MCE cannot rewrite or reseal its target;
- MCE cannot bypass missing target evidence;
- a new adverse consequence requires a new ECE; and
- pre-root neutralization uses the original ECE, not MCE.

### Operational levers

- policy supersession is prospective;
- accepted policy pins remain stable;
- integrity-conflict admission suspension is prospective;
- settled roots remain untouched; and
- reservation release is receipt-authored.

## 19. Deferred

This contract does not choose:

- wire encoding;
- storage engine or atomic-batch representation;
- concrete timing, cost, ceiling, or allocation values;
- drop-locus or corpse entity schema;
- combat formulas and drop tables;
- reputation amounts;
- UI disclosure copy;
- observation windows;
- concrete standing-context composition tables;
- anti-cheat thresholds; or
- implementation migration and release sequence.
