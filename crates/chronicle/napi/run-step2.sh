#!/bin/sh
# run-step2.sh — build + smoke the napi addon, GATED on green Step 0 and Step 1.
#
# Encodes the migration rule: the in-process binding is only built once the evidence is in —
#   - Step 0 (bench-step0.json) shows inproc-handle ~O(N) and a quadratic baseline to contrast.
#   - Step 1 parity gate (TS oracle + cargo test --test parity) is green.
# Then builds `--features napi`, materializes the addon, and smoke-tests it.
#
# Requires Node AND cargo on the host. Each missing tool yields a precise remediation, not a crash.
#
# Usage:  sh crates/chronicle/napi/run-step2.sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
# Crate dir = nearest ancestor with Cargo.toml (vendored crates/chronicle OR standalone repo root).
# No root workspace exists → all cargo builds are crate-local, not `cargo -p chronicle`.
CRATE_DIR=$(d=$SCRIPT_DIR; while [ "$d" != "/" ]; do [ -f "$d/Cargo.toml" ] && { printf '%s' "$d"; break; }; d=$(dirname "$d"); done)
STEP0_JSON="${STEP0_JSON:-$REPO_ROOT/bench-step0.json}"

say() { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---- tools -----------------------------------------------------------------
NODE=""
if have node; then NODE=$(command -v node)
elif [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  ( cd "$REPO_ROOT" && nvm use >/dev/null 2>&1 ) || true
  have node && NODE=$(command -v node)
fi
[ -n "$NODE" ] || { say "GAP: Node not found — nvm install \$(cat $REPO_ROOT/.nvmrc) && nvm use, then re-run."; exit 1; }

have cargo || { say "GAP: cargo not found. Step 2 builds the addon — install Rust (https://rustup.rs) on this host and re-run."; exit 1; }
say "node: $("$NODE" --version)   cargo: $(cargo --version)"

# ---- GATE: Step 0 evidence -------------------------------------------------
[ -f "$STEP0_JSON" ] || { say "GATE FAIL: $STEP0_JSON missing — run: sh crates/chronicle/bench/run-step0.sh --json $STEP0_JSON"; exit 1; }
"$NODE" -e '
  const fs=require("fs");
  const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const s=Object.fromEntries((d.scaling||[]).map(x=>[x.mode,x.verdict||""]));
  const handle=s["inproc-handle"]||"";
  const base=s["inproc-rescan"]||s["spawn"]||"";
  if(!handle.includes("linear")){console.error("GATE FAIL: inproc-handle not ~O(N) linear (got: "+handle+")");process.exit(1);}
  if(!base.includes("quadratic")){console.error("GATE FAIL: no quadratic baseline to contrast (got: "+base+")");process.exit(1);}
  console.log("Step 0 gate OK  (handle="+handle+", baseline="+base+")");
' "$STEP0_JSON"

# ---- GATE: Step 1 parity ---------------------------------------------------
say "regenerating parity golden + running Rust parity gate…"
"$NODE" "$CRATE_DIR/parity/gen-golden.mjs"
( cd "$CRATE_DIR" && cargo test --test parity )
say "Step 1 gate OK  (Rust == TS golden)"

# ---- BUILD the addon -------------------------------------------------------
say ""
say "building napi addon: (cd $CRATE_DIR && cargo build --release --features napi --lib)"
( cd "$CRATE_DIR" && cargo build --release --features napi --lib )

# Locate the cdylib (Linux .so / macOS .dylib / Windows .dll) and materialize it as a .node addon.
LIBDIR="$CRATE_DIR/target/release"
ADDON="$SCRIPT_DIR/chronicle-native.node"
SRC=""
for cand in "$LIBDIR/libchronicle.so" "$LIBDIR/libchronicle.dylib" "$LIBDIR/chronicle.dll"; do
  [ -f "$cand" ] && SRC="$cand" && break
done
[ -n "$SRC" ] || { say "BUILD ERROR: cdylib not found in $LIBDIR (looked for libchronicle.{so,dylib} / chronicle.dll)"; exit 1; }
cp "$SRC" "$ADDON"
say "addon: $ADDON  (from $SRC)"

# ---- SMOKE -----------------------------------------------------------------
say ""
"$NODE" "$SCRIPT_DIR/smoke.mjs" "$ADDON"
say ""
say "STEP 2 GREEN: gates passed, addon built and smoke-tested. apps/server now consumes loader.cjs as the Rust-first backend."
