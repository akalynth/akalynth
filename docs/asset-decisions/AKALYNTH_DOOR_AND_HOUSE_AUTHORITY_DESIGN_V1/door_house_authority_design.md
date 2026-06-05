# AKALYNTH_DOOR_AND_HOUSE_AUTHORITY_DESIGN_V1

Status: implemented_pending_design_review
Scope: design-only

## Purpose

Design how Akalynth will eventually handle door thresholds, open and closed state, house entry, inside/outside classification, roof overlay visibility trigger source, ownership, access lists, lock state, and permission boundaries.

This gate does not implement runtime behavior. It defines the authority boundaries that future runtime gates must satisfy before a reserved conditional tile can become passable, blocked, enterable, owned, locked, or permission-gated.

## Core Rule

Visual appearance does not grant door or house authority.

A door sprite does not create a door. A roof overlay does not create a house. A building visual footprint does not create an interior. A reserved conditional collision/walkability tile does not become clear, blocked, open, locked, or enterable until a later authority gate explicitly promotes that behavior.

## Required Separation

Door and house semantics are separate from:

- visual door sprites
- roof and floor overlays
- debug-client building fixtures
- draft collision candidates
- draft walkability candidates
- NPC-looking visual presets
- shop-looking visual props
- production map promotion

## Authority Questions

This design reserves answers to these questions for future runtime gates:

- Which threshold is a real door?
- Is the door open, closed, locked, or permission-gated?
- Who can open or pass through it?
- Which tiles count as inside a house or building?
- Which server entity, if any, owns the building?
- Which access list or permission policy applies?
- Which presentation overlay should hide or fade after authoritative inside/outside state exists?

## Non-Goals

This gate does not add server door state, house zones, ownership, access lists, lock state, door permissions, roof hiding in gameplay, collision changes, walkability changes, protocol fields, or production map metadata.
