# Rookguard City Expansion V1

Status: source contract plus server/debug-client wiring slice.

## Purpose

Rookguard should feel like a small living city before it becomes a gate. This
slice expands the current tutorial corridor into named city spaces and wires the
end-of-Rookguard profession choice to the existing vocation protocol.

This is not a content-alpha claim. It is the source-backed plan and first
runtime/client wiring for city landmarks, profession choice, NPC guidance,
starter monster practice, asset references, and quest flow.

## City Spaces

| Space | Map landmark | Runtime meaning today |
| --- | --- | --- |
| Plaza | `plaza` | Server presence place `rookguard:plaza`; guide dialogue location |
| Guild hall | `guild_hall` | Server presence place `rookguard:guild_hall`; steward/profession dialogue location |
| Profession hall | `profession_hall` | Client-visible landmark inside the guild hall; vocation choice context |
| Quest board | `quest_board` | Client-visible starter quest marker; no reward by itself |
| Training yard | `training_yard` | Client-visible marker around existing Rookguard training combat space |
| Codex arch | `codex_arch` | Client-visible identity/receipt marker near profession selection |

Only `plaza` and `guild_hall` become server presence places in this slice,
because the presence system already registers those two landmark names. Other
landmarks are visible map/lore markers until a later interaction lane promotes
them.

## Profession Selection

The end-of-Rookguard profession selection uses the existing
`declare_vocation` client message and `vocation_declared` receipt.

Available choices:

- `warden`
- `cantor`
- `hexer`
- `reaver`

Server gate:

- requires the player to be in-world at `rookguard:guild_hall`;
- requires movement, chat, and Tem tutorial proof;
- requires the Rookguard training slime step;
- rejects early declarations with `vocation_requires_rookguard_codex_path`.

Current gameplay effect:

- updates the player's visible vocation badge;
- writes `vocation_declared`;
- updates the receipt-derived identity projection;
- records the selected Codex profession profile on the loop projection;
- restores tutorial, training, vocation, and gate quest progress from replayed
  Rookguard receipts on reconnect/startup;
- grants no gold, item, XP, stat, combat power, or access by itself.

## Codex Shelves

The Rookguard Codex arch exposes the accepted Heroes Codex object and five
related shelves as structured loop state. The active profession lore anchor is:

| Field | Value |
| --- | --- |
| Object ID | `heroes-codex` |
| Status | `accepted` |
| Source | `AKALYNTH_HEROES_CODEX_V1` |
| Evidence | `3f9d4f90...11d630 source` |
| Authority | `Akalynth` |

The six visible shelves are:

| Shelf | Subtitle | Runtime role |
| --- | --- | --- |
| Artifacts Codex | Relics of Power. | Future relic/equipment lane; no Rookguard reward or power grant yet |
| Chronicle of Ages | Events That Changed The World. | Proof-history lane for quest receipts and remembered events |
| Dungeon Codex | Places Where History Still Breathes. | Future First Archive/vault route lane; no dungeon access yet |
| Emberwilds Atlas | The volcanic frontier, mapped. | Future world-map/frontier lane; no Rookguard transition yet |
| Factions Codex | Powers That Shape the World. | Social-role context; no faction rank or standing yet |
| Heroes Codex | The First Legends. | Active profession lore anchored by the First Archivist |

Profession gameplay derives from the Heroes Codex and the First Archivist's
"refused forgetting" principle:

| Vocation | Codex title | Starter role |
| --- | --- | --- |
| `warden` | Warden of the Accord | Protect travelers, escort proof paths, and hold the gate until every required mark is recorded |
| `cantor` | Cantor of the Remembered Word | Use chat, Tem answers, and public signals to turn private action into shared memory |
| `hexer` | Hexer of Unforgotten Marks | Inspect proof trails, identity marks, and pressure patterns before claims become accepted memory |
| `reaver` | Reaver of Recorded Consequence | Practice decisive combat where every strike, kill, and minted item leaves a durable trail |

## NPC Wiring

| NPC | Place | Role |
| --- | --- | --- |
| `rookguard_guide` | `rookguard:plaza` | Movement/chat/Tem gate reminder |
| `rookguard_steward` | `rookguard:guild_hall` | Profession, Codex, quest-board, and training-yard guidance |

NPC dialogue remains read-only. It records `npc_talked` but does not mutate
quest, inventory, profession, or economy state.

## Monster And Asset Boundary

The existing Rookguard server monster remains `training_slime` near the training
yard. Killing it uses the existing `attack_intent`, `mob_kill`, `item_minted`,
and pickup paths.

Visual asset references in this slice are display-only:

- NPC presets already exist under `data/assets-src/sprites/characters/`;
- creature presets already exist under `data/assets-src/sprites/creatures/`;
- the Rookguard training slime now has prompt-stage lineage in
  `data/assets-src/packs/rookguard-starter-v1.json` and a server-published
  visual ID, rendered by source-only debug-client and Android fallbacks;
- Rookguard plaza/guild/training-yard object overlays are wired through
  `apps/debug-client/src/data/highCityVisualLandmarks.ts`;
- world-object landmarks have debug-client lore markers;
- no sprite placement creates collision, loot, shop behavior, door authority, or
  NPC/mob authority.

## Quest Gameplay Path

1. Spawn in the plaza and speak to the guide.
2. Complete movement, chat, and Tem.
3. Visit the quest board for the training-yard direction.
4. Practice against the Rookguard training monster.
5. Speak to the Rookguard steward in the guild hall.
6. Declare a vocation.
7. Use the gate handoff toward High City.

The live loop projection now includes `rookguardQuest`, with step completion for
movement, chat, Tem, training, profession, and gate. The debug client renders
both quest step chips and the selected Codex profession profile. The
`verify:rookguard-quest` check covers both pure quest derivation and
receipt-replayed reconnect projection. The `verify:rookguard-codex-path` check
starts a fresh local WebSocket server and proves movement, chat, Tem, training
slime, Codex vocation declaration, and the gate handoff end to end.
Android exposes the same `declare_vocation` intent from the Rookguard
guild-hall context by decoding shared map landmarks for UI display only; the
server remains the acceptance authority.

## Remaining Work

- Normalize, animate, atlas-pack, and human-review the Rookguard training slime
  before treating it as a promoted runtime sprite.
- Capture live beta/staging presentation proof once this source slice is
  promoted through the normal release lane.
