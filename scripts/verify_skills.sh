#!/usr/bin/env bash
set -euo pipefail

# Validates the Akalynth skill pack: canonical-source frontmatter completeness
# and the single-source / symlink invariant established by the skill-store
# collapse (see .codex/CODEX_MAP.md). Canonical source: .claude/skills/.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SKILLS_DIR="$ROOT_DIR/.claude/skills"
PLUGIN_SKILLS="$ROOT_DIR/plugins/akalynth-studio/skills"
CODEX_AUDIT="$ROOT_DIR/.codex/skills/akalynth-system-audit/skill.md"

errors=0
fail(){ echo "❌ $*" >&2; errors=1; }

[[ -d "$SKILLS_DIR" ]] || { echo "❌ Missing canonical skills dir $SKILLS_DIR" >&2; exit 1; }

# fm_field <file> <key> -> value of `key:` in the first --- ... --- block (trimmed)
fm_field(){
  awk -v key="$2" '
    NR==1 && $0=="---" { infm=1; next }
    infm && $0=="---" { exit }
    infm && $0 ~ "^" key ":" { sub("^" key ":[ \t]*", ""); print; exit }
  ' "$1"
}

# 1) Canonical skills: frontmatter completeness (name==dir, description, version)
count=0
for dir in "$SKILLS_DIR"/*/; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"
  f="$dir/SKILL.md"
  count=$((count + 1))
  if [[ ! -f "$f" ]]; then fail "$name: missing SKILL.md"; continue; fi
  if [[ "$(head -1 "$f")" != "---" ]]; then fail "$name: SKILL.md has no frontmatter"; continue; fi
  [[ "$(fm_field "$f" name)" == "$name" ]] || fail "$name: frontmatter name does not match directory"
  [[ -n "$(fm_field "$f" description)" ]] || fail "$name: empty or missing description"
  [[ -n "$(fm_field "$f" version)" ]] || fail "$name: missing version"
done
[[ "$count" -gt 0 ]] || fail "no skills found in $SKILLS_DIR"
echo "Checked $count canonical skills in .claude/skills/"

# 2) Plugin skills must be symlinks resolving into canonical .claude/skills/
plugin_count=0
if [[ -d "$PLUGIN_SKILLS" ]]; then
  for entry in "$PLUGIN_SKILLS"/*; do
    [[ -e "$entry" || -L "$entry" ]] || continue
    plugin_count=$((plugin_count + 1))
    bn="$(basename "$entry")"
    if [[ ! -L "$entry" ]]; then fail "plugin/$bn: real copy, not a symlink (re-introduces duplication)"; continue; fi
    if [[ ! -e "$entry" ]]; then fail "plugin/$bn: broken symlink -> $(readlink "$entry")"; continue; fi
    target="$(readlink -f "$entry")"
    case "$target/" in
      "$SKILLS_DIR"/*) : ;;
      *) fail "plugin/$bn: resolves outside canonical skills ($target)" ;;
    esac
  done
  [[ "$plugin_count" -gt 0 ]] || fail "no entries under $PLUGIN_SKILLS"
  echo "Checked $plugin_count plugin skill symlinks"
else
  fail "Missing plugin skills dir $PLUGIN_SKILLS"
fi

# 3) Intentional Codex-format audit copy exists and shares the canonical name
if [[ -f "$CODEX_AUDIT" ]]; then
  [[ "$(fm_field "$CODEX_AUDIT" name)" == "akalynth-system-audit" ]] \
    || fail "codex audit copy: name does not match canonical"
else
  fail "Missing codex audit skill $CODEX_AUDIT"
fi

if [[ "$errors" -eq 1 ]]; then
  echo "❌ Skill validation failed" >&2
  exit 1
fi
echo "✅ Skills valid: frontmatter complete, plugin symlinks resolve to canonical source"
