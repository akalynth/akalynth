---
model: haiku
---

Run the Linux bootstrap and verify core toolchain.

1) Run:
!sudo ./scripts/bootstrap_linux.sh

2) Install server deps:
!cd apps/server && npm install

3) Print versions:
!node -v
!npm -v

If anything fails, report the exact error and propose the minimal fix for Debian Trixie.
