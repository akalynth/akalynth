#!/usr/bin/env node
/**
 * Akalynth Verification Spine CLI Entry Point
 */

import('../dist/cli.js').then((mod) => {
  mod.main(process.argv).catch((err) => {
    console.error('[spine] FATAL:', err.message);
    console.error(err.stack);
    process.exit(4); // Internal error
  });
});
