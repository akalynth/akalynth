# Tests

Reserved location for cross-cutting tests that span protocol, world data,
server behavior, and tools.

> **Status:** This directory is currently an empty placeholder (no suites live
> here yet). Most tests today are colocated with the code they cover:
>
> - Android client: `apps/android/app/src/test/...` (JVM unit tests, `*Test.kt`)
> - Server / packages: alongside their sources under `apps/*` and `packages/*`
> - WebSocket scenario verification: `scripts/verify/` (driven by
>   `scripts/verify_mvp.sh`)
> - End-to-end / verification gates: see `npm run verify*` in the root
>   `package.json` and `docs/VERIFICATION_SPINE_API.md`.

When adding a genuinely cross-cutting suite that has no natural home in a single
package, place it here; otherwise prefer the closest domain folder next to the
code under test.
