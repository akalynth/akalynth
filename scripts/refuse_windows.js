// Akalynth platform policy: Linux + Android only.
// Windows is intentionally unsupported.
if (process.platform === 'win32') {
  console.error('Windows is intentionally unsupported for Akalynth. Use Linux (server) or Android (client).');
  process.exit(1);
}

