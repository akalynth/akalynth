import { extractAntiCheatEventsFromFile } from './extract.js';
import { buildFeatureRows } from './features.js';
import { getModelManifest, scoreBatch } from './model.js';
import {
  readFeatureRows,
  readSuspicionScores,
  summarizeScores,
  writeFeatureRows,
  writeSuspicionScores,
} from './report.js';

export async function runExtractFeaturesCli(argv: string[]): Promise<void> {
  const { positional, named } = parseArgs(argv);
  const inputPath = positional[0];
  const outputPath = named.out;
  if (!inputPath || !outputPath) {
    throw new Error('Usage: akalynth-extract-features <receipts.jsonl> --out <features.jsonl>');
  }

  const events = await extractAntiCheatEventsFromFile(inputPath);
  const rows = buildFeatureRows(events);
  writeFeatureRows(outputPath, rows);
  console.log(JSON.stringify({
    ok: true,
    receipts_processed: events.length,
    sessions_emitted: rows.length,
    out: outputPath,
  }));
}

export async function runScoreAnticheatCli(argv: string[]): Promise<void> {
  const { positional, named } = parseArgs(argv);
  const inputPath = positional[0];
  const outputPath = named.out;
  if (!inputPath || !outputPath) {
    throw new Error('Usage: akalynth-score-anticheat <features.jsonl> --out <scores.jsonl>');
  }

  const rows = readFeatureRows(inputPath);
  const scores = scoreBatch(rows);
  const manifest = getModelManifest();
  writeSuspicionScores(outputPath, scores);
  console.log(JSON.stringify({
    ok: true,
    sessions_scored: scores.length,
    out: outputPath,
    model_version: manifest.model_version,
    feature_version: manifest.feature_version,
  }));
}

export async function runReportAnticheatCli(argv: string[]): Promise<void> {
  const { positional } = parseArgs(argv);
  const inputPath = positional[0];
  if (!inputPath) {
    throw new Error('Usage: akalynth-report-anticheat <scores.jsonl>');
  }

  const scores = readSuspicionScores(inputPath);
  console.log(JSON.stringify({
    ok: true,
    ...summarizeScores(scores),
  }));
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const named: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      named[key] = next;
      i += 1;
      continue;
    }
    positional.push(value);
  }

  return { positional, named };
}
