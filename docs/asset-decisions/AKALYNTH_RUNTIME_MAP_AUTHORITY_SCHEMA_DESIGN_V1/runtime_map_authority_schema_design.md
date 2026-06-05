# AKALYNTH_RUNTIME_MAP_AUTHORITY_SCHEMA_DESIGN_V1

Status: implemented_pending_design_review
Scope: docs/schema design only

## Purpose

Design how the accepted non-runtime high-city authority bundle could eventually be represented in runtime/shared map structures without breaking authority boundaries.

This gate does not write schemas into shared runtime packages. It does not change shared map JSON. It does not implement runtime map loading, movement, doors, houses, transitions, collision, walkability, or production promotion.

## Core Question

How can visual, collision, walkability, overlay presentation, door/house, and transition planes become runtime-readable later without smuggling authority from one plane into another?

## Proposed Runtime Layer Split

- runtime_visual_object_layer: client presentation references only unless explicitly server-owned by a later gate
- runtime_overlay_presentation_layer: overlay presentation and visibility binding inputs only
- runtime_collision_layer: server-authoritative static occupancy only after promotion
- runtime_walkability_layer: server-authoritative traversal rules only after promotion
- runtime_door_house_layer: explicit door, house, ownership, access, and lock authority after separate gates
- runtime_transition_layer: explicit source/destination/floor-change authority after separate gates
- runtime_map_bundle_manifest: promoted runtime manifest tying accepted layer versions and receipts together

## Hard Rule

No runtime layer may infer authority from another layer.

Visual object placement does not grant collision. Collision does not grant transition. Walkability does not grant transition. Door visuals do not grant door state. Roof overlays do not grant house entry. Candidate bundles do not grant production map authority.
