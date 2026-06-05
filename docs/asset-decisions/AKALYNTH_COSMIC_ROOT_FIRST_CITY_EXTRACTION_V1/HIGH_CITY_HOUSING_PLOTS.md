# High City Housing Plots

## Purpose

High City should preserve the first-city ownership fantasy currently associated with Azura-style house plots, but as a design target only.

This lane does not create ownership, access lists, storage, doors, or house entry behavior.

## Plot Philosophy

Housing should be visible early but mechanically gated later.

The first city should show:

- small houses
- readable doors
- roof overlay behavior
- signs or mailboxes
- enough space around entrances

It should not imply:

- a player owns the house
- a door can open
- a player can enter
- items can be stored
- a price exists

## Proposed First Plot Set

| Plot id | Visual role | Suggested zone | Notes |
| --- | --- | --- | --- |
| HC-H1 | small starter house | House Steps | first obvious home fantasy |
| HC-H2 | small starter house | House Steps | paired with HC-H1 |
| HC-H3 | corner house | House Steps | can test door and wall readability |
| HC-M1 | shop-adjacent room | Market Lane | future merchant/residence hybrid |
| HC-A1 | archive room | Lantern Archive | future clerk or guild office flavor |

## Housing Visual Requirements

- Doors must remain human-passable visually.
- Door thresholds must remain readable.
- Roof overlays must be visible/faded/hidden only as presentation.
- Interiors must read as walk-in spaces.
- House spacing must not crowd the plaza route.

## Future Authority Boundary

Housing requires later explicit authority planes:

- house zone
- door authority
- ownership
- access policy
- lock state
- collision/walkability resolution
- storage authority

No part of this document grants those systems.

## Relation To Existing Azura Runtime

Existing runtime and tests may still reference Azura property ids. This design does not rename or migrate them. A later production promotion lane must decide how to map or replace those ids.

