#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

const rel = (...parts) => path.join(root, ...parts);
const posix = (file) => file.split(path.sep).join("/");

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readText(file) {
  const abs = rel(file);
  if (!fs.existsSync(abs)) {
    fail(`missing file: ${file}`);
    return "";
  }
  const text = fs.readFileSync(abs, "utf8");
  if (text.trim().length === 0) {
    fail(`empty file: ${file}`);
  }
  return text;
}

function parseJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    fail(`invalid JSON in ${file}: ${error.message}`);
    return null;
  }
}

function stripTomlComment(line) {
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "#" && !quoted) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseTomlShape(file) {
  const text = readText(file);
  const data = { root: {}, tables: new Map(), projectTables: [] };
  let table = "root";
  let arrayKey = null;
  data.tables.set(table, data.root);

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripTomlComment(rawLine).trim();
    if (line.length === 0) return;

    if (arrayKey) {
      if (line === "]") {
        arrayKey = null;
        return;
      }
      if (!/^"([^"\\]|\\.)*",?$/.test(line)) {
        fail(`invalid TOML array item in ${file}:${lineNumber}`);
      }
      return;
    }

    const tableMatch = line.match(/^\[([A-Za-z0-9_.-]+|projects\."[^"]+")\]$/);
    if (tableMatch) {
      table = tableMatch[1];
      if (!data.tables.has(table)) data.tables.set(table, {});
      if (table.startsWith('projects."')) {
        data.projectTables.push(table.slice('projects."'.length, -1));
      }
      return;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (!keyMatch) {
      fail(`invalid TOML structure in ${file}:${lineNumber}`);
      return;
    }

    const [, key, value] = keyMatch;
    if (value === "[") {
      data.tables.get(table)[key] = "[]";
      arrayKey = key;
      return;
    }
    if (
      !/^"([^"\\]|\\.)*"$/.test(value) &&
      !/^(true|false)$/.test(value) &&
      !/^\[\s*\]$/.test(value)
    ) {
      fail(`unsupported TOML value shape in ${file}:${lineNumber}`);
      return;
    }
    data.tables.get(table)[key] = value.replace(/^"|"$/g, "");
  });

  return data;
}

function listFiles(dir, options = {}) {
  const { followSymlinkDirs = false } = options;
  if (!fs.existsSync(rel(dir))) return [];
  const out = [];
  const stack = [rel(dir)];
  const seenDirectories = new Set();
  while (stack.length > 0) {
    const current = stack.pop();
    const realCurrent = fs.realpathSync(current);
    if (seenDirectories.has(realCurrent)) continue;
    seenDirectories.add(realCurrent);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(abs);
      if (entry.isFile()) out.push(posix(path.relative(root, abs)));
      if (entry.isSymbolicLink() && followSymlinkDirs) {
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) stack.push(abs);
        if (stat.isFile()) out.push(posix(path.relative(root, abs)));
      }
    }
  }
  return out.sort();
}

function checkForbiddenMaterial(files) {
  const forbidden = [
    { name: "stale Claude path", re: /\.claude\/(?!skills(?:\/|\b))/i },
    { name: "stale CLAUDE.md reference", re: /\bCLAUDE\.md\b/ },
    { name: "active Copilot instruction", re: /\bcopilot\b/i },
    { name: "GitHub token", re: /\b(github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+)\b/ },
    { name: "Cloudflare token assignment", re: /\b(CLOUDFLARE|CF)_[A-Z0-9_]*TOKEN\s*[:=]\s*['"]?[A-Za-z0-9._-]{12,}/ },
    { name: "private key material", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: "Akalynth secret assignment", re: /\bAKALYNTH_[A-Z0-9_]*(SECRET|TOKEN|KEY)\s*[:=]\s*\S+/ },
  ];

  for (const file of files) {
    const text = readText(file);
    for (const { name, re } of forbidden) {
      if (re.test(text)) fail(`${name} found in ${file}`);
    }
  }
}

function checkSkillFiles(skillsDir) {
  const skillFiles = listFiles(skillsDir, { followSymlinkDirs: true }).filter(
    (file) => /\/SKILL\.md$/.test(file) || /\/skill\.md$/.test(file),
  );
  if (skillFiles.length === 0) fail(`no skill files under ${skillsDir}`);

  const names = new Map();
  for (const file of skillFiles) {
    const text = readText(file);
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!frontmatter) {
      fail(`missing frontmatter: ${file}`);
      continue;
    }

    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!name) fail(`missing skill name: ${file}`);
    if (!description) fail(`missing skill description: ${file}`);
    if (name) {
      if (names.has(name)) fail(`duplicate skill name '${name}' in ${file} and ${names.get(name)}`);
      names.set(name, file);
    }
    if (!/\bAkalynth\b/.test(text)) fail(`skill is not Akalynth-specific: ${file}`);
  }

  return skillFiles;
}

const marketplaceFile = ".agents/plugins/marketplace.json.example";
const manifestFile = "plugins/akalynth-studio/.codex-plugin/plugin.json";
const configFile = ".codex/config.toml.example";

const marketplace = parseJson(marketplaceFile);
const manifest = parseJson(manifestFile);
const config = parseTomlShape(configFile);

if (marketplace && manifest) {
  const entry = marketplace.plugins?.find((plugin) => plugin.name === "akalynth-studio");
  if (!entry) fail("marketplace does not list akalynth-studio");

  const pluginPath = path.normalize(entry?.source?.path ?? "");
  if (pluginPath !== path.normalize("./plugins/akalynth-studio")) {
    fail(`marketplace path mismatch: ${entry?.source?.path}`);
  }
  if (!fs.existsSync(rel(pluginPath))) fail(`marketplace path does not exist: ${pluginPath}`);

  const skillsPath = path.normalize(path.join(pluginPath, manifest.skills ?? ""));
  if (skillsPath !== path.normalize("plugins/akalynth-studio/skills/")) {
    fail(`plugin skills path mismatch: ${manifest.skills}`);
  }
  if (!fs.existsSync(rel(skillsPath))) fail(`plugin skills path does not exist: ${skillsPath}`);

  if (manifest.license !== "UNLICENSED" && manifest.private !== true) {
    fail("plugin manifest must be private or UNLICENSED");
  }
  if (JSON.stringify(manifest).match(/\b(externalNetwork|networkAuthority|networkAccess|permissions)\b/i)) {
    fail("plugin manifest declares network authority");
  }
}

const skillFiles = checkSkillFiles("plugins/akalynth-studio/skills");
const codexFiles = [configFile, ...listFiles(".codex"), ...listFiles(".agents"), manifestFile, ...skillFiles];
checkForbiddenMaterial([...new Set(codexFiles)]);

if (config.root.approval_policy !== "on-request") {
  fail("approval_policy must default to on-request");
}
if (config.root.sandbox_mode === "danger-full-access") {
  fail("sandbox_mode must not default to danger-full-access");
}
if (config.tables.get("sandbox_workspace_write")?.network_access !== "false") {
  fail("workspace-write network_access must default to false");
}
if (config.tables.get("shell_environment_policy")?.inherit !== "core") {
  fail("shell environment policy must inherit only core env by default");
}
if (config.projectTables.includes("/opt/akalynth")) {
  fail("config example must not trust live /opt/akalynth by default");
}
if (config.projectTables.length === 0) {
  warn("config example has no trusted project table");
}

const deploySkill = readText("plugins/akalynth-studio/skills/deploy-steward/SKILL.md");
if (!/Required before mutation/.test(deploySkill) || !/Stop before/.test(deploySkill)) {
  fail("deploy skill must block silent runtime mutation");
}

const receiptSkill = readText("plugins/akalynth-studio/skills/receipt-chain-steward/SKILL.md");
if (!receiptSkill.includes("/var/lib/akalynth") || !receiptSkill.includes("/etc/akalynth")) {
  fail("receipt skill must protect /var/lib/akalynth and /etc/akalynth");
}

const auditSkill = readText(".codex/skills/akalynth-system-audit/skill.md");
if (!auditSkill.includes("https://api.akalynth.com") || !auditSkill.includes("https://beta-api.akalynth.com")) {
  fail("audit skill must default to api.akalynth.com and document beta override");
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(`Codex/plugin scaffold validated (${skillFiles.length} skills).`);
