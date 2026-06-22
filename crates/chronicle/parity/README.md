# TS↔Rust determinism parity gate — Step 1

This is the safety net that makes the witness-kernel Rust rewrite **non-forking**: for every input,
the TypeScript server and the Rust kernel must produce **byte-identical** canonical JSON and BLAKE3.
If they ever diverge, the witness chain forks across languages — so this gate must be green and
**blocking in CI** before any napi-rs addon lands (runbook Step 2+).

## The shared determinism core

The TypeScript hash sites reduce to one shared primitive:

```
blake3( utf8( stable-stringify(x) ) )
```

- TS `packages/shared/hashPrimitive.ts` — `canonicalJson` + `blake3HexUtf8` / `blake3Prefixed`.
- TS `apps/server/src/persist/hash.ts` — receipt wrapper (`event_hash`/`signature` stripped).
- TS `packages/shared/chronicleChain.ts` — chronicle caps/payload/event/global wrapper.
- Rust `crates/chronicle/src/lib.rs` — `canonical_json` + `blake3_hex` (raw hex; the chronicle line
  omits the `blake3:` prefix).

The gate pins the shared core (canonical string + raw blake3 hex). The `blake3:` prefix, domain
prefixes, and field-stripping are thin wrappers. The N-API binding now also exposes the Rust
primitive for smoke-tested parity before any runtime hash-authority flip.

## Files

| file | role |
|------|------|
| `vectors.json` | language-neutral **inputs** + notes (the only file you hand-edit) |
| `gen-golden.mjs` | TS oracle — computes canonical + blake3 from vectors → `golden.json` |
| `golden.json` | generated; the agreed expected output (do not hand-edit) |
| `../tests/parity.rs` | Rust gate — recomputes via the crate and asserts equality with `golden.json` |
| `run-step1.sh` | self-diagnosing runner (Node → golden → `cargo test`) |

## Running

Where the toolchain lives. On this host, Node and cargo are available:

```bash
sh crates/chronicle/parity/run-step1.sh
# or manually:
node crates/chronicle/parity/gen-golden.mjs        # writes golden.json
(cd crates/chronicle && cargo test --test parity)  # asserts Rust == TS golden
```

`gen-golden.mjs --check` fails if `golden.json` is stale vs `vectors.json` — wire that into CI so a
vector edit can't land without a regenerated golden.

## Adding cases / reading failures

Add tricky inputs to `vectors.json` (key ordering, nesting, unicode, numbers), regenerate the golden,
run the Rust gate. The `float` vector is an **intentional** probe of cross-language number formatting
(serde_json vs JS) — a failure there is a real finding to resolve in the consolidation, not a flake.

## CI wiring (Step 1 exit)

Add to the witness/verify job (coordinate with **ci-steward**):

```bash
node crates/chronicle/parity/gen-golden.mjs --check   # golden not stale
(cd crates/chronicle && cargo test --test parity)     # cross-language parity
```

Both must be **blocking** (fail the build, not warn).
