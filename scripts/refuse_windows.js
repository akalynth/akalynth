#!/usr/bin/env node

// Akalynth platform policy: Linux + Android only.
// Windows is intentionally unsupported.

if (process.platform === "win32") {
  console.error("Akalynth policy: Windows is intentionally unsupported. Use Linux.");
  process.exit(1);
}
process.exit(0);
