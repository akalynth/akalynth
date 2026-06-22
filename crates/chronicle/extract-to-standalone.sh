#!/bin/sh
# extract-to-standalone.sh — split crates/chronicle/ into its canonical standalone repo,
# github.com/akalynth/akalynth-chronicle, preserving history. gh-aware: can create + push the repo.
#
# OPERATOR-RUN, ON A NETWORKED HOST WITH gh AUTH (e.g. ops-dev-01). By default it does the LOCAL
# split ONLY (creates a branch ref — non-destructive, reversible with `git branch -D`); the remote
# create/push and the monorepo submodule re-wire are printed for you to run deliberately. Pass
# explicit flags to also create and/or push. The destructive monorepo re-wire is NEVER automated.
#
# PREREQ: the chronicle scaffolding (bench/parity/napi/etc.) must be COMMITTED in this checkout —
# subtree split reads committed history. See crates/chronicle/PUBLISH.md for the full ordered flow.
#
# Usage:
#   sh crates/chronicle/extract-to-standalone.sh [--create] [--public|--private] [--push] [branch]
#     (no flags)      split only, then print next steps
#     --create        create the repo via gh if it doesn't exist (default visibility: --private)
#     --public|--private  visibility for --create
#     --push          push the split branch to <remote> main (repo must exist or use --create)
set -eu

REMOTE="${CHRONICLE_REMOTE:-https://github.com/akalynth/akalynth-chronicle}"
PREFIX="crates/chronicle"
SLUG=$(printf '%s' "$REMOTE" | sed -E 's#^https?://github.com/##; s/\.git$//')

DO_CREATE=0
DO_PUSH=0
VIS="--private"
BRANCH="chronicle-export"
for a in "$@"; do
  case "$a" in
    --create) DO_CREATE=1 ;;
    --push) DO_PUSH=1 ;;
    --public) VIS="--public" ;;
    --private) VIS="--private" ;;
    --*) echo "unknown flag: $a" >&2; exit 2 ;;
    *) BRANCH="$a" ;;
  esac
done

say() { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# ---- preflight -------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { say "ERROR: not a git repo. Run from the monorepo root."; exit 1; }
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
[ -d "$PREFIX" ] || { say "ERROR: $PREFIX not found from repo root $ROOT."; exit 1; }
if [ -n "$(git status --porcelain "$PREFIX")" ]; then
  say "ERROR: $PREFIX has uncommitted changes — commit them first (subtree split reads committed history)."
  say "       See crates/chronicle/PUBLISH.md step 1."
  exit 1
fi
if { [ "$DO_CREATE" = 1 ] || [ "$DO_PUSH" = 1 ]; } && ! have gh; then
  say "ERROR: --create/--push need the gh CLI (for repo creation + git credentials). Install gh or drop the flags."
  exit 1
fi

# ---- split (always; local + reversible) ------------------------------------
say "Splitting '$PREFIX' history into local branch '$BRANCH'…"
git branch -D "$BRANCH" >/dev/null 2>&1 || true
git subtree split --prefix="$PREFIX" -b "$BRANCH"
say "LOCAL split done. Branch '$BRANCH' holds chronicle's history with $PREFIX as the root."

# ---- optional: create the repo ---------------------------------------------
EXISTS=0
if have gh; then gh repo view "$SLUG" >/dev/null 2>&1 && EXISTS=1 || true; fi
if [ "$DO_CREATE" = 1 ] && [ "$EXISTS" = 0 ]; then
  say "Creating $SLUG ($VIS) via gh…"
  gh repo create "$SLUG" "$VIS" --disable-wiki -d "Append-only witness kernel for Akalynth (extracted from monorepo)"
  EXISTS=1
fi

# ---- optional: push --------------------------------------------------------
if [ "$DO_PUSH" = 1 ]; then
  [ "$EXISTS" = 1 ] || { say "ERROR: $SLUG does not exist — re-run with --create."; exit 1; }
  say "Pushing $BRANCH -> $SLUG main…"
  git push "$REMOTE" "$BRANCH:main"
  say "Pushed. Standalone repo is live at $REMOTE"
fi

# ---- next steps ------------------------------------------------------------
say ""
if [ "$DO_PUSH" = 0 ]; then
  say "Next — create + push (or re-run with --create --push):"
  say "  gh repo create $SLUG --private --disable-wiki"
  say "  git push $REMOTE $BRANCH:main"
  say ""
fi
say "Then re-wire the monorepo to consume it as a submodule (DESTRUCTIVE — run deliberately):"
say "  git rm -r $PREFIX"
say "  git commit -m 'chronicle: extract to standalone repo $REMOTE'"
say "  git submodule add $REMOTE $PREFIX"
say "  git commit -m 'chronicle: consume akalynth-chronicle as submodule'"
say ""
say "After re-consuming, run the gates from the submodule root (no -p / workspace needed):"
say "  (cd $PREFIX && sh bench/run-step0.sh && sh parity/run-step1.sh && sh napi/run-step2.sh)"
say ""
say "Rollback the local split:  git branch -D $BRANCH"
