# Map Compiler

Compiles authored maps into runtime-ready maps.

> **Status:** Scaffold. This directory currently holds only this README; the map
> compiler is not implemented yet. The sections below describe the intended
> contract once the tool lands. Do not assume a runnable command exists.
>
> Note: the live world maps consumed today are JSON under
> `packages/shared/maps/` (loaded by `apps/server`), not a built artifact from
> this tool.

## Intended inputs/outputs

- Input: `data/world/maps-src/` (authored maps)
- Output: `data/world/maps-built/` (runtime-ready maps)

Per the repo convention, editors write to `data/*-src/` and compilers emit
`data/*-built/`; runtime consumes only `*-built/`.
