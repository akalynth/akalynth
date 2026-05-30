# Data

Authoring inputs and runtime-ready game data.

## Conventions

- `*-src/` = authored sources (what editors write).
- `*-built/` = runtime-ready output (what compilers emit).
- Editors write to `data/*-src/`, compilers emit `data/*-built/`, and runtime
  consumes only `*-built/`.

## Current contents

The `*-src/` and `*-built/` directories above are conventions for content
tooling that is not yet implemented (see `tools/atlas`, `tools/map-compiler`).
Today this directory holds:

- `phone-studio/maps/` — maps authored/exported by the phone studio (for
  example `phone-test.json`).
- `proofs.jsonl`, `proofs-batches.jsonl` — proof records.

Note: `tools/doc_audit.js` deliberately ignores `data/`, so files here are not
part of the documentation inventory.

