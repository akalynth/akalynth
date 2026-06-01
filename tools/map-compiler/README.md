# Map Compiler

Compiles / generates maps into runtime-ready map data.

> **Status:** `generate.ts` is a runnable **deterministic map generator**
> (`mapgen@v1`): bordered field, districts, roads, spawn, gate, and house plots,
> with byte-identical replay and a sidecar manifest (`map_hash` + `svg_hash`).
> It is a *useful-layout* generator, **not** a canonical world: no generated map
> is promoted to a live world, and balance/production-readiness are not claimed.
>
> Note: the live world maps consumed today are JSON under
> `packages/shared/maps/` (loaded by `apps/server`), not a built artifact from
> this tool.

## Generate

```
tsx tools/map-compiler/generate.ts --name Foo --seed bar \
  [--width 48] [--height 32] [--houses 3] [--districts 4] \
  [--biome azura|grassland|stonehold]
```

Emits `data/world/maps-built/<name>.{json,mapgen.json,svg}` (gitignored —
generated, reproducible from the same params). The `.svg` is a deterministic
vector render of the map; its hash is recorded in the manifest.

## Verification

`apps/server` `npm run verify:mapgen` proves the invariants (M-G1..M-G14):
deterministic map + SVG, manifest hash binding, reachability, house-plot
validity, and no hidden entropy. **These run in CI**: the `mapgen` verifier is
registered in the verification spine and included in the `quick` profile that CI
executes, so determinism/reachability are CI-checked, not only local.

## Intended inputs/outputs

- Input: `data/world/maps-src/` (authored maps)
- Output: `data/world/maps-built/` (runtime-ready maps)

Per the repo convention, editors write to `data/*-src/` and compilers emit
`data/*-built/`; runtime consumes only `*-built/`.
