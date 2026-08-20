# Publishing chronicle to its standalone repo (ops-dev-01)

Canonical home: **`github.com/akalynth/akalynth-chronicle`** (currently 404 — this is a first-time
create + push). Run on **ops-dev-01**, which has the `gh` CLI authed. This dev box can't do it: no
`gh` binary, and the network/credential path is unavailable here.

## Prerequisite (state of the scaffolding)

The witness-kernel-rust scaffolding (`crates/chronicle/{bench,parity,napi}`, `napi_binding.rs`, the
Cargo `napi` feature, `package.json`, this file) is **uncommitted in the dev-box working tree** as of
hand-off — nothing has been committed or pushed. `git subtree split` only sees **committed** history,
and ops-dev-01 syncs from `origin/main`, so these must land on `main` first.

## Step 1 — get the scaffolding onto `main`

`main` is branch-protected (PR + status checks). Open a PR with the `crates/chronicle/**` additions
(scope the commit to chronicle files only — the working tree is shared). Merge it. Net effect: the
scaffolding is on `origin/main`.

## Step 2 — on ops-dev-01, sync + extract + push

```bash
ssh <ops-user>@<ops-dev-01>           # ops host (credentials out-of-band)
cd ~/akalynth-ops/repos/akalynth
git fetch && git reset --hard origin/main      # bring in the chronicle scaffolding

# Create the standalone repo and push chronicle's history to it (private by default):
sh crates/chronicle/extract-to-standalone.sh --create --private --push
#   --public for a public repo; drop --create/--push to dry-run (split only + printed steps)
```

The script: preflights (clean `crates/chronicle`, gh present), `git subtree split`s the prefix into a
branch (history preserved), `gh repo create akalynth/akalynth-chronicle`, then pushes the branch to
`main`. Needs create rights in the `akalynth` org (gh will error if not).

Verify: `gh repo view akalynth/akalynth-chronicle` and that `Cargo.toml` is at the repo root.

## Step 3 (optional, later) — consume it back as a submodule

Reversible monorepo re-wire, via a second PR (the script prints the exact commands):

```bash
git rm -r crates/chronicle
git commit -m 'chronicle: extract to standalone repo'
git submodule add https://github.com/akalynth/akalynth-chronicle crates/chronicle
git commit -m 'chronicle: consume akalynth-chronicle as submodule'
```

Then the gates run from the submodule root (no workspace needed):

```bash
(cd crates/chronicle && sh bench/run-step0.sh && sh parity/run-step1.sh && sh napi/run-step2.sh)
```

## Notes

- Builds are crate-local — there is no root Cargo workspace.
- Visibility (public/private) is your call; the script defaults to `--private` for a fresh extraction.
- Rollback the local split anytime: `git branch -D chronicle-export`.
