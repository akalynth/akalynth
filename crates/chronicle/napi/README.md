# napi-rs binding surface — migration Step 2

In-process Node addon built from the `chronicle` crate, replacing the spawn-per-event bridge with a
long-lived handle (open once at boot → `append` per event). See
`.claude/skills/witness-kernel-rust/references/OPTIMIZATION_PROPOSAL.md` for why, and
`MIGRATION_RUNBOOK.md` for the staged plan.

## STATUS — built and smoke-tested locally

The binding (`../src/napi_binding.rs`), Cargo wiring (`[lib] crate-type`, optional `napi`/`napi-derive`/
`napi-build` deps, the `napi` feature, `build.rs`), and this harness are in place and have been
compiled locally through `run-step2.sh`. The `napi` feature is still **default-off** for plain crate
builds, so the existing rlib + `chronicle_append` bin + Step 0/Step 1 builds are unchanged.

## Default build is untouched

- `napi`/`napi-derive`/`napi-build` are `optional = true`; `napi_binding.rs` and `napi_build::setup()`
  are behind `#[cfg(feature = "napi")]`. A plain `cargo build -p chronicle` / `cargo test` compiles
  none of it.
- `[lib] crate-type = ["rlib", "cdylib"]` keeps `rlib` (bin + tests link it) and adds an (unused-by-
  default) `cdylib`. The napi symbols only appear with `--features napi`.

## Build + verify (gated)

```bash
sh crates/chronicle/napi/run-step2.sh
```

The runner **refuses to build** until:
1. **Step 0** evidence (`bench-step0.json`) shows `inproc-handle` ~O(N) linear with a quadratic
   baseline to contrast — run `sh crates/chronicle/bench/run-step0.sh --json bench-step0.json` first.
2. **Step 1** parity is green (`gen-golden.mjs` + `cd crates/chronicle && cargo test --test parity`).

Then it builds `--features napi`, materializes the cdylib as `chronicle-native.node`, and runs
`smoke.mjs` through `loader.cjs` (open → append×2 → verify chain). For production cross-platform prebuilds, use
`@napi-rs/cli` (`napi build --release`) instead of the plain-cargo path the runner uses for the smoke.

## Files

| file | role |
|------|------|
| `../src/napi_binding.rs` | the `#[napi]` `ChronicleHandle` (open / append / verify / sequence) |
| `run-step2.sh` | gated build + smoke runner (enforces Step 0 + Step 1 green) |
| `smoke.mjs` | loads the built `.node`, appends + verifies a 2-entry chain |
| `loader.cjs` | `openChronicle()` with native default plus explicit offline auditor fallback; `apps/server/src/witness/chronicleAdapter.ts` opens it native-only |
| `chronicle-native.node` | build artifact (produced by the runner; do not commit) |

## Runtime integration

`apps/server/src/witness/chronicleAdapter.ts` now imports this loader, prefers the native addon by
default, opens the backend once at boot, and fails closed when the native addon is unavailable.
The old `chronicle_append` process bridge is not reachable from server runtime; it remains only as
an explicit offline auditor/demo fallback for direct `openChronicle({ allowCliFallback: true })`
tooling. Step 5 source consolidation is partially landed: the loader also exposes Rust canonical
JSON + BLAKE3 helpers, and
`apps/server/tools/chronicle-adapter-smoke.ts` checks those helpers against the shared TS primitive
when the addon is present. Remaining Step 5 work is CI/release policy and any future runtime-native
hash flip. Specs live under `.claude/skills/witness-kernel-rust/references/`.
