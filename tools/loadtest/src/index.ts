#!/usr/bin/env node
/**
 * Load Test Harness CLI
 *
 * Authorized load testing tool for Akalynth server.
 * Only runs in local/staging environments (safety envelope enforced).
 */

import { program } from 'commander';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buildRunConfig, buildRunConfigSync, CLIOptions, HARNESS_VERSION } from './config.js';
import { LoadTestRunner } from './runner.js';
import { listScenarios } from './scenarios/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// CLI Definition
// -----------------------------------------------------------------------------

program
  .name('loadtest')
  .description('Authorized load test harness for Akalynth server')
  .version(HARNESS_VERSION);

program
  .command('run')
  .description('Run a load test')
  .requiredOption('-s, --scenario <name>', 'Scenario to run')
  .option('-c, --clients <number>', 'Fixed client count (single plateau)', parseInt)
  .option('--step-test', 'Run progressive step test')
  .option('--max-clients <number>', 'Max clients for step test', parseInt)
  .option('-d, --duration <duration>', 'Hold duration (e.g., 60s, 5m)')
  .option('--plateau-duration <duration>', 'Per-plateau hold duration')
  .option('--seed <number>', 'Random seed for reproducibility', parseInt)
  .option('--server <url>', 'Server WebSocket URL', 'ws://127.0.0.1:3000')
  .option('--verify-tem', 'Verify TEM challenge handling')
  .option('-v, --verbose', 'Verbose output')
  .action(async (opts: CLIOptions) => {
    try {
      console.log('');
      console.log('╔════════════════════════════════════════════════╗');
      console.log('║   Akalynth Load Test Harness                   ║');
      console.log('║   AUTHORIZED LOCAL/STAGING USE ONLY            ║');
      console.log('╚════════════════════════════════════════════════╝');
      console.log('');

      const config = await buildRunConfig(opts);
      const runner = new LoadTestRunner(config, baseDir, {
        verbose: opts.verbose,
        verifyTem: opts.verifyTem,
      });

      // Handle graceful shutdown
      const shutdown = () => {
        console.log('\nReceived shutdown signal, aborting...');
        runner.abort();
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      const results = await runner.run();

      // Exit with appropriate code
      process.exit(results.verdict === 'pass' ? 0 : 1);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(2);
    }
  });

program
  .command('scenarios')
  .description('List available scenarios')
  .action(() => {
    console.log('Available scenarios:');
    for (const name of listScenarios()) {
      console.log(`  - ${name}`);
    }
  });

program
  .command('validate')
  .description('Validate configuration without running (pre-flight check)')
  .requiredOption('-s, --scenario <name>', 'Scenario to validate')
  .option('--server <url>', 'Server URL to validate', 'ws://127.0.0.1:3000')
  .action((opts) => {
    try {
      // Use sync validation (no DNS lookup) for quick pre-flight check
      buildRunConfigSync(opts);
      console.log('Configuration valid (pre-flight check passed)');
      console.log('Note: Full DNS resolution validation occurs at run time.');
    } catch (err) {
      console.error(`Validation failed: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// Default to run command if scenario is first arg
const args = process.argv.slice(2);
if (args.length > 0 && !args[0].startsWith('-') && !['run', 'scenarios', 'validate', 'help'].includes(args[0])) {
  // Assume first positional arg might be a scenario, insert 'run'
  args.unshift('run', '-s');
}

program.parse(['node', 'loadtest', ...args]);

// Show help if no command
if (process.argv.length <= 2) {
  program.help();
}
