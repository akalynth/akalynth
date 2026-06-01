# Atlas Tool

Builds sprite atlases for runtime use.

> **Status:** Scaffold. This directory currently holds only this README; the
> atlas builder is not implemented yet. The sections below describe the intended
> contract once the tool lands. Do not assume a runnable command exists.

## Intended inputs/outputs

- Input: `data/assets-src/sprites/` (authored sprite sources)
- Output: `data/assets-built/atlas/` (runtime-ready atlas)

Per the repo convention, editors write to `data/*-src/` and compilers emit
`data/*-built/`; runtime consumes only `*-built/`.
