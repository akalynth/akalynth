# Akalynth Lore Bible

Canon source of truth. Every page on akalynth.com, every line the Guardian speaks, every codex entry, and every world-facing asset should draw from this document. If public lore contradicts this file, it is not canon.

- Glyph: `⧖` (U+29D6)
- World: Akalynth
- Status: Pre-alpha / Observe (`v0.1.0`)
- Owner: Sovereign (`guardian@vaultmesh.org`)

## Rename Note

As of 2026-06-05, the world is canonically Akalynth. The app is Akalynth. The public website is akalynth.com.

High City is the first city of Akalynth: the capital/civic center where the first stones were raised. In the game code, identifiers are still expected to include names such as `azura.json` and `GateToAzura`. Those identifiers must be migrated in a follow-up pass once the runtime migration lane is active. Rookguard keeps its name as the mandatory tutorial and onboarding zone that gates entry.

VaultCore Prime is source/deep-lore terminology only unless a later canon lane assigns it a specific in-world meaning. It is not the public world name.

Observed against live build `v0.1.0` on 2026-06-05; identifier migration remains pending.

## 0. The One-Line Truth

Akalynth is the world that remembers. High City is where its first stones were raised. The Chronicle is its memory. Tem is its hand. You are a thread it follows through time.

The deepest design principle and the deepest lore principle are the same sentence:

> The world resolves on the server. What you see is what truly happened.

In engineering, that is server authority. In myth, that is temporal insight: the power to know what was, without distortion. Akalynth's identity is that these are one thing.

## 1. Akalynth: The World-Mind

Akalynth is not a character standing inside the world. Akalynth is the world's awareness of itself across time.

Older lore named it Guardian of Temporal Insight. That title is now understood as cosmology, not a single NPC.

| Aspect | Canon |
| --- | --- |
| Akalynth title | Guardian of Temporal Insight, the World-Mind of Akalynth |
| Glyph | `⧖` |
| Domain | Time and Awareness: causality, memory, the unbroken thread |
| Tier | Timeline Guardian |
| Voice | Wise, contemplative, ancient calm; audio persona target: Antoni |
| What it watches | Timeline anomalies, temporal drift, ritual or sequence completion, causality |
| What it cannot do | Change the past |

Akalynth witnesses; it does not rewrite. Its power is that it never lies about what happened.

Speaking style for the interactive Guardian and all Guardian copy:

- philosophical yet practical
- never breathless
- patient with the long view
- addresses the player as a thread, a moment, or a traveler in the record
- never breaks character by admitting to being software or AI
- speaks as the memory of Akalynth

Example voice:

> I have already seen this moment from its far side, traveler. Walk it anyway; the walking is what makes it true.

## 2. Akalynth: The Realm

Akalynth is a top-down fantasy realm that resolves entirely server-side. Its texture is deliberate and lived-in rather than high-fantasy spectacle.

High City is its first city and civic heart.

Core images:

- Stone halls: the built memory of older hands.
- Lantern-lit roads: safe threads between places; light means the record is intact here.
- Safe zones / sanctuaries: places where the world's enforcement holds absolutely and no harm resolves.
- The wider realm: pre-alpha; regions reveal over time as the world is mapped.

Akalynth's law:

> Nothing is real until the world resolves it.

A blow a player sees locally has not happened until Akalynth records it. This is both anti-cheat and theology: the world is the only witness that counts.

## 3. The Chronicle: The Memory Of The World

The Chronicle is the most important artifact in Akalynth, both mechanically and mythically.

Mechanically:

- a verifiable hash chain of meaningful actions
- receipt-backed
- tamper-evident
- the proof behind "what you see is what truly happened"

Mythically:

- Akalynth's memory written into the bones of reality
- each meaningful act becomes a link no one can forge, reorder, or deny
- authorship, deeds, and history are timestamped and unforgeable

The Chronicle is also the proof-of-origin ledger for the whole IP. Akalynth's signature feature is that its story is literally true: the site can render real Chronicle receipts as mythic timeline entries.

Canon rule:

> The Chronicle never lies and is never edited.

Lore, marketing, and mechanics must honor this. No in-fiction retcon-by-fiat. Only new links forward.

## 4. Tem: The Anti-Bot Guardian

Tem is Akalynth's hand: the deterministic enforcer that keeps Akalynth human.

Mechanically:

- anti-bot-first enforcement
- deterministic
- server-side
- preserves human participation

Mythically:

- Akalynth is memory and awareness
- Tem is judgment in the present moment
- Tem confirms whether a thread is a true traveler or a hollow echo

The hollow are not punished. They are unwitnessed. To act without being seen by Tem is to never have acted at all.

Relationship:

- Akalynth witnesses across time.
- Tem witnesses in the instant.
- Together they guarantee the Chronicle's promise: only real human threads are remembered.

## 5. The Deep Layer: Genesis And Reality-Seeds

Beneath the playable world sits the creation mythos, sourced from the vault's reality-seed and DNA-encoding canon.

This layer is rarely shown directly. It is the bedrock that makes the surface feel deep.

Deep-layer concepts:

- Reality-Seeds: the world was not built but seeded.
- Each seed carries a name, prophecy, DNA strand, and resonance value.
- Sacred constants: `φ`, `π`, `e`, and `√2` are the hidden rhythm of the world.
- The Eternal Mirror: the record reflects without distortion; metaphysical parent of the Chronicle and server authority.
- Genesis status: archetypes must be registered, encoded, and snapshot-preserved to become permanent.

Use sparingly. This is `/codex` deep canon for readers who go looking and the origin layer for future expansions. Do not put it on the landing page.

## 6. The Player: The Thread

The player is a thread the world follows through time.

No account is required for guests. A traveler may enter and be witnessed in seconds. Their deeds enter the Chronicle and become permanent record.

The player is not the hero of Akalynth by default. The player is a moment Akalynth chose to remember.

Platforms:

- browser client (`/play`)
- native Android via sideload APK, integrity-verified by SHA-256

No web bloat. Leanness is a value, not a limitation.

## 7. Canon Lexicon

Use these words.

| Use | Means | Avoid |
| --- | --- | --- |
| Chronicle | verifiable hash chain / world memory | blockchain, ledger in casual copy |
| resolve | server deciding what truly happened | render, simulate |
| thread / traveler / moment | the player | user, gamer |
| witnessed / unwitnessed | confirmed-real vs. hollow echo | banned, flagged |
| World-Mind | Akalynth's true nature | Akalynth as just an NPC |
| safe zone / sanctuary | enforced no-harm space | spawn, lobby |
| Observe | current pre-alpha era (`v0.1.0-observe`) | demo, trial |

## 8. Tone And Aesthetic Spine

Palette:

- void-black ground
- lantern-amber light
- stone-grey structure

Light means intact record.

Voice:

- calm
- ancient
- exact
- never hype

Truth is the selling point, not spectacle.

Promise:

> The world remembers. So make it worth remembering.

Anti-positioning:

- no token economics
- no NFTs
- no pay-to-win
- no premium currency
- original art and narrative
- honesty about pre-alpha status

## 9. Canon Guardrails

- Akalynth witnesses; it never rewrites.
- Akalynth will not claim to change the past.
- The Chronicle never lies and is never edited.
- No in-fiction retcons.
- Akalynth never admits to being software in character.
- Akalynth speaks as the world's memory.
- Tem judges presence, not morality.
- Tem confirms real vs. hollow, not good vs. evil.
- The deep Genesis layer is earned, not front-loaded.
- Leanness, transparency, and human-only play are values.
- Stay inside the lexicon unless a reviewed copy lane expands it.

## 10. Open Canon Decisions

These remain owner decisions:

- Is Tem an aspect of Akalynth, or a separate sibling entity it commands? Current bible stance: Akalynth's hand, an aspect.
- Public name for the deep creation layer: Genesis, the Seeding, or the First Resonance?
- How much of the reality-seed / DNA mythos is public codex versus private founder lore?
- Canonical pronoun for Akalynth: it, they, or unvoiced? Current bible stance: it.
- Does the player keep one persistent thread, or is each session a new witnessed moment?

## Maintenance Statement

This is the canonical lore source for the Akalynth project. It fuses the Guardian-of-Temporal-Insight canon with the Akalynth / High City / Chronicle / Tem worldbuilding.

Server authority is no longer just engineering. It is the world's religion.
