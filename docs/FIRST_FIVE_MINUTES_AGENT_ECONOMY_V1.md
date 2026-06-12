# First Five Minutes: Agent Economy Path V1

Status: local proof design note.

## Purpose

This document turns the agent economy simulator roles into one deterministic
first-five-minutes path for the pre-alpha showcase.

It is a design target backed by `AKALYNTH_AGENT_ECONOMY_SIM_PROOF_V1`, not a
claim that the live client already presents this path as a polished onboarding
sequence.

## Player Promise

Within five minutes, a new player should understand:

- movement is server-authoritative;
- work creates receipt-backed gold;
- nearby places and NPCs give context;
- loot and inventory are server-owned;
- property creates a visible market goal;
- other player roles make the economy legible.

## Deterministic Path

1. **Arrive in Rookguard.**
   The player appears at a known place and receives the simple task: move,
   observe, and speak to the local guide.

2. **Earn first gold as the worker.**
   The player completes a small work contract, sees gold change, and receives a
   receipt-backed proof line. This corresponds to the simulator worker role,
   `sim:worker:1`, which starts with 0 gold and earns through work.

3. **Pick up one visible item.**
   The player sees a dropped training item and picks it up. The point is not
   combat depth; the point is that item authority stays on the server and can be
   materialized from receipts.

4. **See the Azura market goal.**
   The player is shown that property exists, listings exist, and ownership is a
   long-term target. This corresponds to the homesteader role, which buys
   affordable property when possible.

5. **Watch merchant pressure.**
   The player sees a merchant/listing/auction example so the economy is not just
   solo earning. This corresponds to the merchant roles, including resale and
   auction settlement in the simulator proof.

6. **Close with one world signal.**
   The player sees a world-event teaser or NPC dialogue sample so the loop has a
   social/world reason to continue beyond earning gold.

## Simulator Evidence Mapping

| Showcase beat | Simulator role/evidence |
| --- | --- |
| Earn first gold | `worker` completes work and ends with earned gold |
| Server-owned item | simulator mints and picks up loot |
| Property goal | `homesteader` buys affordable property |
| Market pressure | `merchant` roles list, bid, refund, and settle auction flow |
| Social/world context | NPC dialogue samples and Witness Moth Bloom world-event receipts |
| Auditability | 133 simulator receipts and SQLite materialization checks |

## Acceptance Criteria

The first-five-minutes path is ready to present only when:

- `npm run verify:showcase` passes;
- the showcase transcript includes the agent economy simulator proof;
- `agent-economy-training.jsonl` contains worker, homesteader, and merchant
  agent steps;
- `agent-economy-receipts.jsonl` contains receipt evidence for work, wallet,
  inventory/loot, property, auction, combat/death, NPC/world-event-adjacent
  systems where applicable;
- the presenter uses the bounded pre-alpha language from `docs/CURRENT_STAGE.md`.

## Non-Goals

- No production launch claim.
- No promise of complete content-alpha depth.
- No Android release claim.
- No claim that all simulator events are already surfaced in a polished client
  UI.
