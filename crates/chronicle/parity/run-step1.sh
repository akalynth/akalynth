#!/bin/sh
# run-step1.sh — self-diagnosing runner for the TS↔Rust determinism parity gate (Step 1).
#
# Closes tool gaps instead of failing cryptically:
#   - finds Node (PATH, then nvm/fnm) or prints the exact install step and exits.
#   - ensures bench/parity deps (@noble/hashes, fast-json-stable-stringify); npm ci if available.
#   - regenerates parity/golden.json from vectors.json via the TS oracle.
#   - runs `cargo test --test parity` from the crate directory if cargo is present; if not, the TS golden is
#     still produced (TS side proven) and the Rust assertion is reported as DEFERRED with guidance.
#
# Usage:  sh crates/chronicle/parity/run-step1.sh
# Run where the toolchain lives. On this host, Node and cargo are available.
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
# Crate dir = nearest ancestor with Cargo.toml (vendored crates/chronicle OR standalone repo root).
# No root workspace exists, so the parity test is crate-local, not `cargo -p chronicle`.
CRATE_DIR=$(d=$SCRIPT_DIR; while [ "$d" != "/" ]; do [ -f "$d/Cargo.toml" ] && { printf '%s' "$d"; break; }; d=$(dirname "$d"); done)
GEN="$SCRIPT_DIR/gen-golden.mjs"

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
  say "  nvm install \$(cat \"$REPO_ROOT/.nvmrc\") && nvm use   # or any system Node 20+"
  say "  Then re-run this script."
  exit 1
fi
say "node: $NODE ($("$NODE" --version 2>/dev/null))"

# ---- 2. Deps ---------------------------------------------------------------
if [ ! -d "$REPO_ROOT/node_modules/@noble/hashes" ] || [ ! -d "$REPO_ROOT/node_modules/fast-json-stable-stringify" ]; then
  if have npm; then
    say "installing workspace deps (npm ci)…"
    ( cd "$REPO_ROOT" && npm ci ) || ( cd "$REPO_ROOT" && npm install )
  else
    say "GAP: bench deps missing and npm not found. (cd $REPO_ROOT && npm ci), then re-run."
    exit 1
  fi
fi

# ---- 3. Regenerate the TS-side golden --------------------------------------
say ""
say "regenerating parity golden from vectors.json…"
"$NODE" "$GEN"

# ---- 4. Rust assertion -----------------------------------------------------
say ""
if have cargo; then
  say "running Rust parity gate: (cd $CRATE_DIR && cargo test --test parity)"
  ( cd "$CRATE_DIR" && cargo test --test parity )
  say ""
  say "PARITY GREEN: Rust canonical JSON + BLAKE3 match the TS oracle for all vectors."
else
  say "DEFERRED: cargo not found — TS golden generated, but the Rust assertion did not run."
  say "  Install Rust (https://rustup.rs) or run on a host with cargo, then:"
  say "    (cd $CRATE_DIR && cargo test --test parity)"
fi
