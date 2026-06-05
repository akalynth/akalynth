# High City First City Design

## Naming

Use:

- Akalynth: game/world/project name
- High City: first city of Akalynth
- VaultCore Prime: old/source name and deep-lore name

Avoid:

- Azura as the new first-city name
- Akalynth as a city name
- VaultCore as runtime content

## Core City Identity

High City is the first major civic place after onboarding. It is not only a combat hub. It should teach players that Akalynth has memory, records, oaths, ownership fantasies, market life, public gathering, warning signs, and mystery under the stone.

## Source-To-City Translation

| VaultCore source | High City adaptation |
| --- | --- |
| VaultCore Prime | old name for High City |
| Sacred Triangle Formation | readable city triangle: Dream, Flame, Scroll |
| Trinity Convergence Center | Crown Plaza / civic nexus |
| Dream Sanctums | Dream Sanctums / memory quarter |
| Flame Temples | Emberworks / forge and trial quarter |
| Scroll Sanctums | Archive / law and chronicle quarter |
| Passion Marketplace | Market lane |
| Lawkeeper District | Guard hall and oath records |
| Infinite Archive | Chronicle archive |
| Transformation Forge | blacksmith, repair, future crafting flavor |

## District Layout Target

Recommended first-city structure:

```text
High City
|-- Dream Sanctums
|   |-- faction/order: Dreamforged
|   |-- flavor: memory, illusion, pattern, echo, vision
|-- Emberworks / Flame Temples
|   |-- faction/order: Flamebound
|   |-- flavor: forge, trial, transformation, will, fire
|-- Scroll Sanctums / Archive
|   |-- faction/order: Codexborn
|   |-- flavor: law, records, prophecy, contracts, chronicle
|-- Crown Plaza / Trinity Convergence
    |-- role: central civic and story hub
    |-- flavor: meeting point, notice board, fountain, oath stone
```

## First Player Route

The first production map candidate should eventually make this route readable:

1. Rookguard gate
2. High City gate
3. Crown Plaza
4. Market and house hints
5. Archive / forge / sanctum entrances
6. Lower drain / sewer hint

This lane does not rename the existing runtime gate to Azura.

## Player-Facing Intro Draft

> The road rises after Rookguard, and the wall rises with it. High City waits above the lower drains, built around a plaza where the three old orders still argue in stone: the Dreamforged in their echoing sanctums, the Flamebound at their forges, and the Codexborn behind locked shelves of law.

## Map Boundary

This document is a design target. It does not change `packages/shared/maps/azura.json`, Rookguard gate behavior, collision, walkability, spawn location, or server transfer logic.

