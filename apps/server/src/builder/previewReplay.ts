// Deterministic preview replay log writer (PR-9) — ops-local artifacts only.

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function resolveOpsRoot(): string {
  const env = process.env.AKALYNTH_OPS_ROOT;
  if (env && existsSync(join(env, 'AGENTS.md'))) return env;
  for (const candidate of [join(process.cwd(), '../..'), '/home/sovereign/akalynth-ops']) {
    if (existsSync(join(candidate, 'AGENTS.md'))) return candidate;
  }
  return process.cwd();
}

export function previewArtifactSlug(namespace: string): string {
  return namespace.replace(/^preview:/, '').replace(/:/g, '-');
}

export function previewReplayRelPath(namespace: string): string {
  return `builder/previews/${previewArtifactSlug(namespace)}/replay.jsonl`;
}

export function appendPreviewReplayEvent(
  namespace: string,
  event: Record<string, unknown>,
): string {
  const opsRoot = resolveOpsRoot();
  const rel = previewReplayRelPath(namespace);
  const file = join(opsRoot, rel);
  mkdirSync(join(opsRoot, 'builder/previews', previewArtifactSlug(namespace)), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ ...event, preview_only: true })}\n`, 'utf8');
  return rel;
}

export function rookguardPreviewScreenshotRefs(): string[] {
  return [
    'builder/previews/rookguard-kit-v1/guild-hall-annex-before.png',
    'builder/previews/rookguard-kit-v1/guild-hall-annex-after.png',
    'builder/previews/rookguard-kit-v1/gate-overlook-after.png',
  ];
}