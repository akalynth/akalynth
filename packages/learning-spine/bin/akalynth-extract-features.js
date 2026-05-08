#!/usr/bin/env node
import { runExtractFeaturesCli } from '../dist/cli.js';

await runExtractFeaturesCli(process.argv.slice(2));
