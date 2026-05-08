#!/usr/bin/env node
import { runScoreAnticheatCli } from '../dist/cli.js';

await runScoreAnticheatCli(process.argv.slice(2));
