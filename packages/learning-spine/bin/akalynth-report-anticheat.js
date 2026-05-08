#!/usr/bin/env node
import { runReportAnticheatCli } from '../dist/cli.js';

await runReportAnticheatCli(process.argv.slice(2));
