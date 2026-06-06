---
name: package-steward
description: Use when adding, removing, or restructuring packages in the Akalynth monorepo — shared TypeScript types, inter-package dependencies, build order, workspace config, or tsconfig paths.
version: 0.1.0
---

# Package Steward

The monorepo package graph is a load-bearing contract. Shared type exports define the protocol between server, clients, and the coordination kernel. Build order is not incidental — it is enforced by workspace dependency resolution.

## Scope

- Root `package.json` and workspace config
- `packages/*/package.json` and `packages/*/tsconfig.json`
- Shared type exports from `packages/shared/`, `packages/coordination-kernel/`, `packages/data/`
- `packages/ci-cd-change-control/` and `packages/verification-spine/`
- `tsconfig.json` path aliases and project references

## Cross-cuts

- **`protocol-guardian`** — shared message and HTTP types live in `packages/shared/`; type removals or renames are breaking protocol changes.
- **`coordination-kernel-steward`** — exported identity and receipt types are security contracts; do not silently widen or narrow them.
- **`ci-steward`** — build job order in CI depends on workspace dependency resolution; package restructuring may break the CI graph.

## Rules

- No circular package dependencies. Verify with a clean root build before committing.
- Shared type removals are breaking changes — treat them like protocol changes and coordinate with `protocol-guardian`.
- Do not add a new package without a clear ownership statement: which skill governs it.
- Workspace version bumps must be justified. Coordinate with `release-steward` for version field changes.
- `tsconfig` path aliases must stay in sync with `package.json` exports. A mismatch that builds locally but breaks in CI is a CI failure, not an environment failure.
- Do not add `devDependencies` with runtime side effects to shared packages.

## Verification

- Build: `npm run build` from repo root (clean, dependency order)
- Generated sync: `npm run check:generated`
- Type check: `npx tsc --noEmit` from root or per-package
- Confirm no circular deps: check build output for resolution errors

## Output must include

- Packages added, removed, or restructured.
- Type exports changed (added, removed, renamed).
- Build order impact.
- CI job graph impact, if any.
- Verification commands and outputs.
