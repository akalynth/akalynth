#!/usr/bin/env bash
set -euo pipefail

# Symlink Akalynth canonical skills into ~/.claude/skills/ for Claude Code.
# Canonical source: repos/akalynth/.claude/skills/ (see AGENTS.md).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SKILLS_SRC="${ROOT_DIR}/.claude/skills"
TARGET="${HOME}/.claude/skills"

[[ -d "${SKILLS_SRC}" ]] || {
  echo "❌ Missing canonical skills dir: ${SKILLS_SRC}" >&2
  exit 1
}

mkdir -p "${TARGET}"

synced=0
for dir in "${SKILLS_SRC}"/*/; do
  [[ -d "${dir}" ]] || continue
  name="$(basename "${dir}")"
  ln -sfn "$(readlink -f "${dir}")" "${TARGET}/${name}"
  synced=$((synced + 1))
done

echo "✅ Synced ${synced} skills from ${SKILLS_SRC} → ${TARGET}"
echo "   Handoff entry: ${TARGET}/akalynth-continue → references/CONTINUATION_STATE.md"