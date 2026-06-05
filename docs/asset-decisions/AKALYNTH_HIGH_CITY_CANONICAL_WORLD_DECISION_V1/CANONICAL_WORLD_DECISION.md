# Canonical World Decision

## Lane

AKALYNTH_HIGH_CITY_CANONICAL_WORLD_DECISION_V1

This lane is a **decision record**. It is docs-only. It changes no runtime, map, protocol, or content.

## The Decision

1. **Akalynth is the world.** It is the world/app/site/project name. It is not a city name.
2. **High City is a city inside Akalynth** — specifically the canonical **first city**, the first major civic place after the Rookguard onboarding gate.
3. **VaultCore Prime** is High City's old/source name, preserved in deep lore only.
4. **Azura** remains a legacy *runtime* identifier (maps, tile names, ids) and is **not** renamed by this lane. Its migration to `high_city` is a separate downstream lane.
5. **Rookguard** keeps its name as the mandatory onboarding gate.

## Canonical Structure

Akalynth is the world. High City is the first city within it. High City's canonical
internal structure is:

```text
Akalynth                      (world / app / site)
└── High City                 (first city of Akalynth)
    ├── Sky Spires            (elevated towers / high district)
    ├── Dream Sanctums        (Dreamforged order quarter — memory, dream, echo, sigil)
    ├── Trinity Nexus         (central civic hub where the orders meet)
    ├── Market District       (trade, stalls, services)
    ├── Archive Vaults        (Codexborn order quarter — law, records, oath, chronicle)
    ├── Undercity             (lower city / drains / mystery)
    └── Ley Core              (the city's deep power/memory heart)
```

This tree is the canonical authority for High City district naming going forward.
Where it differs from earlier working names, this tree wins (see
`DECISION_INPUTS_AND_PRECEDENT.md` for the mapping).

## District Precedent Mapping

| Canonical district | Earlier working name(s) | Source root |
| --- | --- | --- |
| Sky Spires | (new) — candidate home for Dreamforged spire towers | "Recursive Spiral Towers" |
| Dream Sanctums | Dream Sanctums | Dreamforged / Dream Sanctums |
| Trinity Nexus | Trinity Convergence / Crown Plaza | Trinity Convergence Center |
| Market District | Market Lane | Passion Marketplace / Wisdom Exchange |
| Archive Vaults | Scroll Sanctums / Archive | Codexborn / Scroll Sanctums / Infinite Archive |
| Undercity | Lower Drain | transition/boundary concepts |
| Ley Core | (new) — deep power/memory heart | energy grid / Sacred Triangulation Point |

## Open Reconciliation Items (owner decisions, deferred — not resolved here)

These are recorded explicitly rather than silently resolved:

1. **Flamebound / Emberworks placement.** The world bible canonizes three orders
   (Dreamforged, Flamebound, Codexborn), but the canonical tree names no
   forge/flame district. Decision needed: does the Flamebound order live inside an
   existing district (e.g. a forge within Market District or Ley Core), become its
   own district later, or change role? **Until decided, Flamebound remains a canon
   order without a fixed district.**
2. **Sky Spires** is new — needs a lore role (Dreamforged spires? civic/noble high
   district? watch towers?).
3. **Ley Core** is new — needs a lore role (the city's memory/power heart, tied to
   the Chronicle theme?).
4. **World-bible district names** (`Emberworks`, `Crown Plaza`, `Lower Drain`,
   `Scroll Sanctums`) should be aligned to canonical names in a follow-up lane.

## Status

status: implemented_pending_review

This decision is consistent with — and ratifies — the canon already carried by the
world-bible extraction and the Azura identifier migration plan.
