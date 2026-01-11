# Spine Lock v1

**Status**: 🔒 Active  
**Effective**: 2026-01-11  
**Purpose**: Prevent regression to flat monolith structure

## Locked Structure

The following directory layout is **locked** and enforced by CI:

```
akalynth/
├── apps/           # Application entry points
│   ├── server/     # Server runtime (was top-level server/)
│   ├── debug-client/
│   └── android/
├── packages/       # Shared libraries
│   └── shared/     # Protocol, types, constants (was top-level shared/)
├── data/           # Game data, maps, assets
├── tools/          # Build tooling, editors
├── tests/          # Integration & protocol tests
├── infra/          # CI/CD, deployment, monitoring
├── scripts/        # Repository automation
└── docs/           # Architecture, design docs
```

## Forbidden Paths

CI **FAILS** if these top-level directories exist:

- `server/`  *(now `apps/server/`)*
- `shared/`  *(now `packages/shared/`)*
- `client/`  *(was never migrated, use `apps/*` for clients)*

## What Can Change

### ✅ Safe to add

- New subdirectories **under** locked paths
  - Example: `packages/game-engine/`, `tools/map-editor/`
- New top-level docs
  - Example: `CONTRIBUTING.md`, `SECURITY.md`
- Non-code artifacts
  - Example: `LICENSE`, `.github/`, `.vscode/`

### ⚠️ Requires approval

- New top-level **code** directories
  - Process: Open issue → Discuss necessity → Update this doc
  - Example: Adding `plugins/` or `extensions/`

### ❌ Never allowed

- Recreating forbidden paths
- Flat structure with executables at root
- Bypassing monorepo layout via symlinks

## Migration Guide

### If you have local branches with old paths

```bash
# 1. Stash your changes
git stash

# 2. Update branch
git checkout main
git pull

# 3. Create new branch
git checkout -b fix/my-feature

# 4. Restore & migrate your changes
git stash pop
git mv server/* apps/server/     # If you were in server/
git mv shared/* packages/shared/  # If you were in shared/

# 5. Update imports
# Change: import { X } from '../../shared/types'
# To:     import { X } from '@akalynth/shared/types'

# 6. Test
cd apps/server && npm run build
cd ../debug-client && npm run dev
```

### For merge conflicts

1. Accept incoming changes (new structure)
2. Manually move your changes to correct directories
3. Run `npm run verify:all` to confirm

## Enforcement

### Pre-merge check

CI runs `.github/workflows/spine-lock.yml`:

```yaml
- Fail if server/, shared/, client/ exist at root
- Pass only if apps/, packages/ structure intact
```

### Local hook

Install: `scripts/precommit-hook.sh`

- Warns if committing to forbidden paths
- Non-blocking (CI is final gate)

## Rationale

1. **Scalability**: Clear separation between apps, libraries, tools
2. **Onboarding**: Standard monorepo conventions
3. **Build**: Independent versioning and deployment
4. **Tooling**: Works with Nx, Turborepo, pnpm workspaces

## History

| Version | Date       | Changes                          |
|---------|------------|----------------------------------|
| v1      | 2026-01-11 | Initial lock after monorepo migration |

## Questions?

See: [ARCHITECTURE.md](ARCHITECTURE.md) or open an issue tagged `spine-lock`.
