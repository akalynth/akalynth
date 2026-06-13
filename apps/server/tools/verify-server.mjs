#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['tsx', 'tools/verify-guarantees.ts', ...process.argv.slice(2)]);
run('npm', ['run', 'test:character-v2']);
run('npm', ['run', 'test:web-economy']);
run('npm', ['run', 'test:account-roles']);
run('npm', ['run', 'test:account-handle']);
