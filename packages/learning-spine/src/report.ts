import type { LearningFeatureRow, SuspicionScore } from './types.js';
import { readJsonlFile, writeJsonlFile } from './jsonl.js';

export function readFeatureRows(filePath: string): LearningFeatureRow[] {
  return readJsonlFile<LearningFeatureRow>(filePath);
}

export function readSuspicionScores(filePath: string): SuspicionScore[] {
  return readJsonlFile<SuspicionScore>(filePath);
}

export function writeFeatureRows(filePath: string, rows: LearningFeatureRow[]): void {
  writeJsonlFile(filePath, rows);
}

export function writeSuspicionScores(filePath: string, rows: SuspicionScore[]): void {
  writeJsonlFile(filePath, rows);
}

export function summarizeScores(scores: SuspicionScore[]) {
  const bandCounts = {
    low: 0,
    medium: 0,
    high: 0,
  };
  for (const score of scores) {
    bandCounts[score.band] += 1;
  }
  return {
    total_sessions: scores.length,
    by_band: bandCounts,
  };
}
