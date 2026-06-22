# Witness append benchmark — Step 0 evidence gate

This is the evidence gate for the `witness-kernel-rust` migration (see
`.claude/skills/witness-kernel-rust/references/MIGRATION_RUNBOOK.md` Step 0). It preserves the
retired spawn-per-event path as a benchmark baseline, per the repo's "no claim without evidence"
doctrine.

## What it proves

The claim in `OPTIMIZATION_PROPOSAL.md`: the retired spawn-per-event chronicle bridge was **O(N²)**
(a fresh process **plus** a full-log `read_tail` scan per event, `crates/chronicle/src/lib.rs:269`),
and a persistent in-process handle (`last_hash` in memory) is **O(N)**.

Three modes, all writing the same chronicle line format as `lib.rs:144`
(`prev|event_hash|sig|canonical_json`, raw blake3 hex, Ed25519 over `prev|event`, fsync per append):

| mode            | models                                   | expected scaling |
|-----------------|------------------------------------------|------------------|
| `spawn`         | retired baseline (spawnSync per event)   | ~O(N²), spawn-dominated |
| `inproc-rescan` | in-process but re-reads log each append  | ~O(N²) — isolates the rescan term |
| `inproc-handle` | the **proposed** persistent-handle model | ~O(N) |

`inproc-rescan` vs `inproc-handle` shows the rescan **is** the quadratic term (no process cost in
either). `spawn` vs `inproc-handle` shows the full real-world win.

## Honesty / scope

Measures structural latency **scaling**, which is transport- and language-independent. The
in-process modes use JS crypto (`@noble/hashes` blake3 + `node:crypto` Ed25519), **not** the final
Rust napi-rs addon. Byte-for-byte TS↔Rust determinism parity is **Step 1's** gate, not this one.

## Running

Run where the toolchain lives. On this host, Node and cargo are available.

**Recommended — self-diagnosing runner.** Detects/loads Node (PATH → nvm → fnm), installs bench
deps via `npm ci` if missing, builds the `chronicle_append` binary when `cargo` is present (and
falls back to in-process-only with `--no-spawn` when it isn't), then runs and writes JSON evidence.
It prints a precise remediation line for any tool it can't find:

```bash
sh crates/chronicle/bench/run-step0.sh            # full sweep, evidence -> bench-step0.json
sh crates/chronicle/bench/run-step0.sh --quick    # smoke run
```

**Manual** — if you already have Node + (optionally) the built binary:

```bash
(cd crates/chronicle && cargo build --release)  # builds target/release/chronicle_append (for `spawn`)
node crates/chronicle/bench/witness-append-bench.mjs
```

Crypto deps (`@noble/hashes`, `fast-json-stable-stringify`) resolve from the repo-root
`node_modules` via Node's upward module resolution — no install step needed if the workspace is set up.

### Flags

| flag | effect |
|------|--------|
| `--n 256,512,1024,2048` | N sweep (default; use doublings for a clean ratio read) |
| `--quick` | tiny sweep `64,128,256` for a smoke run |
| `--no-spawn` | skip the spawn baseline (e.g. binary not built) |
| `--max-spawn-n 1024` | cap N for the (slow) spawn mode |
| `--no-fsync` | drop per-append fsync in the in-process modes |
| `--bin <path>` | override the `chronicle_append` path |
| `--json <path>` | also write raw results as JSON for evidence capture |

If the binary is absent the script prints build instructions and continues with the in-process
modes (which alone prove the O(N²) rescan term vs the O(N) handle).

## Reading the output

Per mode it prints total ms, µs/append, and the **total-time ratio per N-doubling**: ~2× ⇒ linear
(O(N)), ~4× ⇒ quadratic (O(N²)). Capture the table + the `--json` file as the change's evidence.
The migration proceeds only once `inproc-handle` reads ~O(N) and the baseline reads ~O(N²).
