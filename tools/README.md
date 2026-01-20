# Tools
Internal editors, compilers, and validators for game content.
Editors write to `data/*-src/`; compilers emit `data/*-built/`.
Tools should be run from source to keep outputs deterministic.

Docs audit:
- `node tools/doc_audit.js` (writes `artifacts/akalynth-doc-audit.json` + `artifacts/akalynth-doc-audit-summary.md`)
