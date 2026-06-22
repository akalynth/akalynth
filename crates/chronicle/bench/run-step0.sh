#!/bin/sh
# run-step0.sh — self-diagnosing runner for the witness append benchmark (Step 0 gate).
#
# Closes tool gaps instead of failing cryptically:
#   - finds Node (PATH, then nvm/fnm), or prints the exact install step and exits.
#   - ensures bench deps (@noble/hashes, fast-json-stable-stringify) are present;
#     runs `npm ci` if npm is available, else explains.
#   - builds the chronicle_append binary with cargo for the `spawn` baseline;
#     if cargo is absent, runs the in-process modes only (--no-spawn) — which alone
#     prove the O(N²) rescan vs O(N) handle.
#
# Usage:  sh crates/chronicle/bench/run-step0.sh [extra bench flags…]
#   e.g.  sh crates/chronicle/bench/run-step0.sh --quick
#         sh crates/chronicle/bench/run-step0.sh --n 256,512,1024,2048
#
# Run where the toolchain lives. On this host, Node and cargo are available.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
# Crate dir = nearest ancestor with Cargo.toml. Works both vendored (crates/chronicle) and when
# chronicle is its own repo root (github.com/akalynth/akalynth-chronicle). No root workspace exists,
# so builds are crate-local — never `cargo -p chronicle` from the monorepo root.
CRATE_DIR=$(d=$SCRIPT_DIR; while [ "$d" != "/" ]; do [ -f "$d/Cargo.toml" ] && { printf '%s' "$d"; break; }; d=$(dirname "$d"); done)
BENCH="$SCRIPT_DIR/witness-append-bench.mjs"
OUT="${STEP0_JSON:-$REPO_ROOT/bench-step0.json}"

say() { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---- 1. Node ---------------------------------------------------------------
NODE=""
if have node; then
  NODE=$(command -v node)
elif [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  ( cd "$REPO_ROOT" && nvm use >/dev/null 2>&1 ) || nvm use --lts >/dev/null 2>&1 || true
  have node && NODE=$(command -v node)
elif have fnm; then
  eval "$(fnm env)" >/dev/null 2>&1 || true
  have node && NODE=$(command -v node)
fi

if [ -z "$NODE" ]; then
  say "GAP: Node not found."
  say "  Pinned version: $(cat "$REPO_ROOT/.nvmrc" 2>/dev/null || echo 24.15.0) (.nvmrc / .node-version)."
  say "  Install one of:"
  say "    nvm install \$(cat \"$REPO_ROOT/.nvmrc\") && nvm use"
  say "    # or a system Node 20+ (the pure-JS bench has no native deps; 20/22/24 all work)"
  say "  Then re-run this script."
  exit 1
fi
say "node: $NODE ($("$NODE" --version 2>/dev/null))"

# ---- 2. Bench JS deps ------------------------------------------------------
if [ ! -d "$REPO_ROOT/node_modules/@noble/hashes" ] || [ ! -d "$REPO_ROOT/node_modules/fast-json-stable-stringify" ]; then
  say "GAP: bench deps missing in node_modules (@noble/hashes / fast-json-stable-stringify)."
  if have npm; then
    say "  Installing workspace deps with: npm ci"
    ( cd "$REPO_ROOT" && npm ci ) || ( cd "$REPO_ROOT" && npm install )
  else
    say "  npm not found. Install workspace deps where npm exists: (cd $REPO_ROOT && npm ci), then re-run."
    exit 1
  fi
else
  say "bench deps: present"
fi

# ---- 3. chronicle_append binary (for the `spawn` baseline) -----------------
SPAWN_FLAGS=""
BIN_A="$REPO_ROOT/target/release/chronicle_append"
BIN_B="$REPO_ROOT/crates/chronicle/target/release/chronicle_append"
if [ -x "$BIN_A" ] || [ -x "$BIN_B" ]; then
  say "chronicle_append: built (spawn baseline enabled)"
elif have cargo; then
  say "chronicle_append: not built — building with cargo (release)…"
  ( cd "$CRATE_DIR" && cargo build --release )
  say "chronicle_append: built (spawn baseline enabled)"
else
  say "GAP: cargo not found and binary not built — running IN-PROCESS modes only (--no-spawn)."
  say "  To include the real spawn baseline, install Rust (https://rustup.rs) and re-run,"
  say "  or build on a host with cargo: (cd $CRATE_DIR && cargo build --release)"
  SPAWN_FLAGS="--no-spawn"
fi

# ---- 4. Run ----------------------------------------------------------------
say ""
say "running: $NODE $BENCH $SPAWN_FLAGS --json $OUT $*"
# shellcheck disable=SC2086
"$NODE" "$BENCH" $SPAWN_FLAGS --json "$OUT" "$@"
say ""
say "evidence written to: $OUT"
