#!/usr/bin/env node
/*
 * Docs Audit Tool
 *
 * Produces a deterministic inventory + hash of documentation artifacts.
 * Output is written to JSON and a human-readable summary.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);

function getArg(name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasFlag(name) {
  return argv.includes(name);
}

const isCi = hasFlag('--ci');
const outPath = getArg('--out') || 'artifacts/akalynth-doc-audit.json';
const summaryPath = getArg('--summary') || 'artifacts/akalynth-doc-audit-summary.md';

const repoRoot = path.resolve(__dirname, '..');

const includeRoots = [
  'docs',
  'packages',
  'README.md',
  'CLAUDE.md',
  'LICENSE',
  'AUDIT_REPORT.md',
  'CODEX_SIGNAL_REPORT.md',
];

const ignoreDirs = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
  'artifacts',
  'data',
  'apps/server/audit',
]);

function shouldIgnoreDir(dirPath) {
  const rel = path.relative(repoRoot, dirPath).replace(/\\/g, '/');
  if (!rel) return false;
  return rel.split('/').some((segment) => ignoreDirs.has(segment)) || rel.startsWith('artifacts');
}

function walkDir(dirPath, out) {
  if (shouldIgnoreDir(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out);
      continue;
    }
    if (entry.isFile()) {
      out.push(full);
    }
  }
}

function collectFiles() {
  const files = [];
  for (const root of includeRoots) {
    const abs = path.resolve(repoRoot, root);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      walkDir(abs, files);
    } else if (stat.isFile()) {
      files.push(abs);
    }
  }

  return files
    .map((abs) => path.relative(repoRoot, abs).replace(/\\/g, '/'))
    .filter((rel) => rel.endsWith('.md') || rel === 'README.md' || rel === 'CLAUDE.md' || rel === 'LICENSE')
    .filter((rel) => !rel.startsWith('node_modules/'))
    .sort();
}

function hashFile(absPath) {
  const data = fs.readFileSync(absPath);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const text = data.toString('utf8');
  const lines = text.split('\n').length;
  return {
    hash,
    bytes: data.length,
    lines,
  };
}

function ensureRequiredDocs() {
  const required = ['docs/README.md'];
  const missing = required.filter((rel) => !fs.existsSync(path.resolve(repoRoot, rel)));
  if (missing.length > 0) {
    console.error(`[doc-audit] missing required docs: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function run() {
  if (isCi) ensureRequiredDocs();

  const relFiles = collectFiles();
  const files = relFiles.map((rel) => {
    const abs = path.resolve(repoRoot, rel);
    const { hash, bytes, lines } = hashFile(abs);
    return { path: rel, sha256: hash, bytes, lines };
  });

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);

  const report = {
    generated_at: new Date().toISOString(),
    root: path.relative(process.cwd(), repoRoot) || '.',
    total_files: files.length,
    total_lines: totalLines,
    total_bytes: totalBytes,
    files,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  const summaryLines = [
    '# Akalynth Doc Audit Summary',
    '',
    `Generated: ${report.generated_at}`,
    '',
    `Total files: ${report.total_files}`,
    `Total lines: ${report.total_lines}`,
    `Total bytes: ${report.total_bytes}`,
    '',
    '## Files',
  ];

  for (const f of files) {
    summaryLines.push(`- ${f.path} (lines=${f.lines}, sha256=${f.sha256})`);
  }

  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf8');
  console.log(`[doc-audit] wrote ${outPath}`);
  console.log(`[doc-audit] wrote ${summaryPath}`);
}

if (require.main === module) {
  run();
}
