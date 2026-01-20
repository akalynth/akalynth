# Monetization Constitution (Draft)

> **Status:** Doctrine (constitutional surface).  
> **Change control:** Amendments only; see Article VII.  
> **Governs:** Any value-entry system (money/crypto) and its “not power” proof surface.

This document turns `docs/MONETIZATION_BLUEPRINT.md` into enforceable, audit-friendly policy language.

Implementation references:

- `docs/MONETIZATION_RECEIPTS.md`
- `docs/MONETIZATION_JUSTIFICATIONS.md`

## Preamble

Money may support the world — never dominate it.  
Fairness is preserved even under pressure.

## Article I — Prime Law (Non-Negotiable)

Money can never buy power, outcomes, or bypasses.

Money may only purchase:

- Expression (cosmetic identity and presence)
- Memory (preservation of real deeds)
- Convenience that does not increase progress rate
- World support that is shared, not owned
- Operational services that do not affect outcomes

## Article II — Definitions

- **Power**: Any purchase that increases win probability, survival odds, efficiency of conflict, or dominance (directly or indirectly).
- **Soft Power**: Any purchase that does not directly modify mechanics, but statistically increases access, opportunity, visibility, or social leverage in contested systems.
- **Outcome**: Any purchase that changes results of contested systems (PvP, leaderboards, scarce rewards, competitive progression).
- **Bypass**: Any purchase that removes constraints intended as gameplay pressure (cooldowns, penalties, friction, failure costs).
- **Progress Rate**: Net advancement per unit time (XP/hour, loot/hour, rank/hour, reputation/hour).
- **Contested System**: Any system where one player’s advantage can diminish another’s opportunity or standing.

If a proposed purchase cannot be proven non-power in these terms, it is forbidden.

## Article III — Forever Forbidden (Constitutional Prohibitions)

Money must never purchase, enable, or indirectly produce:

- Combat power (damage, stats, win probability)
- Drop rates or loot quality
- Progression speed relative to other players
- Access to exclusive content that affects outcomes
- Cooldown reduction, friction reduction, or penalty removal
- Leaderboard position or ranking influence
- PvP advantages (direct or indirect)
- Anti-cheat immunity or enforcement leniency

If it affects who wins, who survives, or who dominates — money is locked out.

## Article IV — Permitted Categories

### IV.1 — Cosmetic Expression (Safe Forever)

Permitted purchases include:

- Skins (character, mounts, companions)
- Animations (idle, emotes, spell visuals only)
- Titles, badges, marks (non-stat)
- Voice packs / sound themes
- UI themes (maps, frames, HUD style)

Cosmetics must never:

- Obscure hitboxes
- Reduce visual clarity
- Mimic rare drops visually

### IV.2 — Narrative & Memory

Permitted purchases include:

- Personal Chronicle Entries
- “Record this moment permanently”
- Legend Engraving
- Optional inscription attached to a real achievement
- Death Echoes (visual memorials)
- World Witness Marks (cosmetic markers of participation)

**Truth rule**: You can only record what you actually did. Money buys preservation, not fabrication.

### IV.3 — Convenience (Strictly Bounded)

Permitted purchases include:

- Offline notifications / logs
- Inventory organization tools
- Replay tools (combat logs, heat graphs, receipts UI)
- Cosmetic fast-travel visuals (not shorter routes)

Not permitted:

- Faster XP
- Reduced cooldowns
- Shortened timers
- Skipped challenges

**Invariant**: Time saved must never convert into more progress per hour.

### IV.4 — Social & World Support (Shared Effects)

Permitted purchases include:

- Guild banners & halls (visual scale only)
- Event sponsorship (cosmetic world changes during events)
- NPC patronage (flavor dialogue, appearance changes)
- Server-wide festivals (temporary visual/audio changes)
- Community-funded monuments

**Sharing rule**: Effects must be shared, not owned.

### IV.5 — Services (Not Advantages)

Permitted purchases include:

- Character rename / appearance reset
- Account transfers (with audit receipts)
- Extra character slots (with shared progression caps)
- Private practice instances (no rewards)
- Replay/sandbox simulations

## Article V — Money Interface (Future-Safe)

If real money (or crypto) is ever enabled:

- Value enters as **receipted credits**
- Credits are **non-transferable** and **non-power**
- Credits are **capped per period**
- Credits are **auditable** and **reversible at the policy layer**

Ideal abstraction:

```
Money → Support Tokens → Non-competitive uses only
```

No direct money → gold → power loops.

## Article VI — Auditability (Hard Requirement)

Every monetization action (purchase, grant, revoke, refund) must emit immutable receipts sufficient to reconstruct:

- Who initiated it (actor/account)
- What was purchased (policy category + item id)
- Why it was permitted (policy rule id / allowlist)
- How value moved (credits in/out; caps applied)
- How it can be reversed (refund/revoke receipt linkage)

## Article VII — Amendments

Changing any prohibition in Article III requires:

1. Update `docs/MONETIZATION_CONSTITUTION.md`
2. Update `docs/MONETIZATION_BLUEPRINT.md`
3. Publish a player-facing change note (plain language)
4. Add an explicit “Why this is not power” argument per change

If a change cannot pass the “not power” test, it is not an amendment — it is a breach.

## Article VIII — Enforcement

Any system, feature, or item that violates this constitution must be disabled regardless of revenue impact.

Audit failure overrides commercial considerations.
