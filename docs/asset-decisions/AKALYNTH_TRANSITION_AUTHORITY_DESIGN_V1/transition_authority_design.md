# AKALYNTH_TRANSITION_AUTHORITY_DESIGN_V1

Status: implemented_pending_design_review
Scope: docs/schema design only

## Purpose

Design how Akalynth will eventually represent transition authority for sewer entrances, stairs, ladders, floor changes, gates to underground areas, teleport-like transitions, and interior/exterior transfer points.

This gate does not implement runtime transitions. It defines the authority boundary that future fixture and runtime gates must satisfy before any transition-looking tile can move a player, change floor, change map region, hide or show overlays, alter spawn safety, or affect movement rules.

## Core Rules

A sewer grate sprite does not imply a sewer transition.
A stair sprite does not imply floor movement.
A ladder sprite does not imply climb behavior.
A dark hole sprite does not imply teleport behavior.
A visual floor index does not imply server floor authority.
A transition candidate does not imply destination validity.

## Required Explicit Bindings

A future transition authority record must explicitly bind:

- source tile
- destination tile or destination region
- source floor and destination floor
- directionality
- activation rule
- server authority source
- safety policy
- promotion receipt

Until those exist in a later gate, transition-like visual and collision/walkability candidates remain reserved and non-runtime.

## Non-Goals

This gate does not add working sewers, stairs, floor changes, teleports, movement rules, spawn safety, production map metadata, protocol fields, or server-side transition behavior.
