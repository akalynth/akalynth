# Packages

Shared libraries used by the apps, tools, and tests in this monorepo. Packages
are kept framework-agnostic where possible. They are wired as npm workspaces
(`packages/*`) and several reference each other via `file:` dependencies.

## Packages

| Package | npm name | Description |
|---------|----------|-------------|
| [`shared/`](./shared) | (workspace, unscoped) | Shared protocol, schemas, constants, paths, and map validation. |
| [`coordination-kernel/`](./coordination-kernel) | `@akalynth/coordination-kernel` | Domain-agnostic coordination primitives (receipts, capabilities, replay). |
| [`verification-spine/`](./verification-spine) | `@akalynth/verification-spine` | Unified verification system (fail-closed); ships the `akalynth-verify` CLI. |
| [`learning-spine/`](./learning-spine) | `@akalynth/learning-spine` | Receipt-driven offline anti-cheat learning pipeline. |
| [`ai-tool-governance/`](./ai-tool-governance) | `@akalynth/ai-tool-governance` | Constitutional governance adapter for AI tool execution (`ai-gov-verify` CLI). |
| [`ci-cd-change-control/`](./ci-cd-change-control) | `ci-cd-change-control` | Proof-native CI/CD change-control example (`ci-cd-verify` CLI). |
| [`data/`](./data) | (not a package) | Data files (proof JSONL exports). |

## Building

The core spine packages are built together from the repository root:

```bash
npm run build:packages   # coordination-kernel + learning-spine + verification-spine
```

Individual packages build with their own `npm run build` (`tsc`). See each
package's README for usage details.
