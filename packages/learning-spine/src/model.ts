import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type {
  HeuristicConfig,
  LearningFeatureRow,
  LearningModelManifest,
  SuspicionBand,
  SuspicionScore,
  SuspicionTopSignal,
} from './types.js';

const GENERATED_AT = '2026-05-08T00:00:00.000Z';

interface RuleContribution {
  name: string;
  value: number;
  contribution: number;
}

let cachedConfig: HeuristicConfig | null = null;
let cachedManifest: LearningModelManifest | null = null;

export function getModelManifest(): LearningModelManifest {
  loadConfig();
  return cachedManifest!;
}

export function scoreFeatureRow(row: LearningFeatureRow): SuspicionScore {
  const config = loadConfig();
  if (row.feature_version !== config.feature_version) {
    throw new Error(
      `Feature version mismatch: expected ${config.feature_version}, received ${row.feature_version}`
    );
  }

  const contributions: RuleContribution[] = config.rules.map((rule) => {
    const rawValue = row[rule.feature];
    const value = typeof rawValue === 'number' ? rawValue : 0;
    const normalized = Math.max(0, Math.min(1, value / rule.scale));
    return {
      name: String(rule.feature),
      value: Number(value.toFixed(3)),
      contribution: Number((rule.weight * normalized).toFixed(3)),
    };
  });

  const rawScore = contributions.reduce((sum, entry) => sum + entry.contribution, 0);
  const score = Math.max(0, Math.min(100, Number(rawScore.toFixed(2))));
  const band = scoreToBand(score);
  const topSignals = contributions
    .filter((entry) => entry.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
    .map<SuspicionTopSignal>((entry) => ({
      name: entry.name,
      value: entry.value,
      contribution: entry.contribution,
    }));

  return {
    player_id: row.player_id,
    session_id: row.session_id,
    score,
    band,
    top_signals: topSignals,
    feature_version: row.feature_version,
    model_version: config.model_version,
    computed_at: GENERATED_AT,
    first_sequence: row.first_sequence,
    last_sequence: row.last_sequence,
    receipt_count: row.receipt_count,
  };
}

export function scoreBatch(rows: LearningFeatureRow[]): SuspicionScore[] {
  return rows.map((row) => scoreFeatureRow(row));
}

function loadConfig(): HeuristicConfig {
  if (cachedConfig && cachedManifest) {
    return cachedConfig;
  }

  const configUrl = new URL('../config/heuristic-weights.json', import.meta.url);
  const raw = fs.readFileSync(configUrl, 'utf8');
  const parsed = JSON.parse(raw) as HeuristicConfig;
  const checksum = createHash('sha256').update(raw).digest('hex');

  cachedConfig = parsed;
  cachedManifest = {
    model_version: parsed.model_version,
    feature_version: parsed.feature_version,
    kind: 'heuristic',
    weights_checksum: checksum,
    generated_at: GENERATED_AT,
  };
  return parsed;
}

function scoreToBand(score: number): SuspicionBand {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}
