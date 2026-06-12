# Akalynth Proof Run Template

## Run Identity

- Commit:
- Branch:
- Operator:
- Date:
- Environment:
- Node version:
- OS:

## Scope

This proof run is bounded to a local or CI pre-alpha showcase path.

It does not prove production readiness, public launch readiness, Android release readiness, or complete persistence guarantees.

## Commands Executed

```bash
npm install
npm run build
npm run verify:showcase
cd apps/server && npm run verify
cd apps/server && npm run verify:agent-economy-simulation
```

If any command is skipped, record why.

## Artifacts

- CI run URL:
- Verification artifact:
- Receipt fixture:
- Chronicle fixture:
- Command transcript:
- Server log:
- Debug-client observation notes:
- Agent economy simulator transcript:
- Agent economy summary JSON:
- Agent economy training JSONL:
- Agent economy receipts JSONL:

## Claims Supported

Mark only claims proven by this run.

- [ ] Server builds
- [ ] Debug client builds
- [ ] Protocol sync passes
- [ ] MVP verification passes
- [ ] Receipt/chronicle hygiene passes
- [ ] Constitutional/domain verifiers pass
- [ ] Local server starts
- [ ] Debug client connects
- [ ] Basic movement works
- [ ] Chat works
- [ ] Receipts are emitted
- [ ] Agent economy simulator verifier passes
- [ ] Agent economy simulator receipts materialize into SQLite projection checks
- [ ] Worker / homesteader / merchant loop is represented in simulator output

## Claims Not Supported By Default

These remain unsupported unless a separate named artifact proves them.

- Production readiness
- Public launch readiness
- Android release readiness
- Content-alpha readiness
- Complete anti-cheat coverage
- Complete persistence guarantees
- External auditor acceptance
- Cryptographic receipt envelope completeness

## Failure Recording

If the run fails, preserve:

- failed command,
- exit code,
- relevant output,
- current commit,
- local modifications if any,
- whether the failure blocks showcase readiness.

Do not rewrite the run as successful.

## Closure Language

Use only one of these closure states:

- `not_started`
- `blocked_failed_preflight`
- `blocked_failed_runtime`
- `showcase_passed_local_only`
- `showcase_passed_ci_and_local`

A run is not `showcase_passed_ci_and_local` unless both the local runbook and CI evidence are named.
