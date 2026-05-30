# Tools

Internal editors, compilers, validators, and developer utilities for Akalynth.
Content tools follow the convention that editors write to `data/*-src/` and
compilers emit `data/*-built/`. Tools should be run from source to keep outputs
deterministic.

## Directory map

- `tools/loadtest/` — authorized load test harness (TypeScript). See
  `docs/LOAD_TEST_HARNESS.md`.
- `tools/atlas/` — sprite-atlas builder. Scaffold only (README, no implementation yet).
- `tools/map-compiler/` — authored-map compiler. Scaffold only (README, no implementation yet).
- `tools/validator/` — data/schema validator. Scaffold only (README, no implementation yet).
- `tools/doc_audit.js` — deterministic documentation inventory + hashes.
- `tools/validate-codex-plugin.mjs` — validates the `akalynth-studio` Codex plugin manifest.

## Docs audit

```bash
node tools/doc_audit.js
```

Writes `artifacts/akalynth-doc-audit.json` and
`artifacts/akalynth-doc-audit-summary.md` (paths are relative to the current
working directory; override with `--out` and `--summary`). Pass `--ci` to also
fail when required docs (currently `docs/README.md`) are missing.

## Codex plugin validation

```bash
node tools/validate-codex-plugin.mjs
# or: npm run validate:codex-plugin
```
