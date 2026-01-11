#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODE="$ROOT_DIR/packages/shared/protocol.ts"
DOC="$ROOT_DIR/docs/PROTOCOL.md"

die(){ echo "❌ $*" >&2; exit 1; }

[[ -f "$CODE" ]] || die "Missing $CODE"
[[ -f "$DOC" ]]  || die "Missing $DOC"

# Extract message type strings from protocol.ts (e.g., type: 'connect')
code_types="$(
  grep -oE "type:\s*['\"][a-z_]+['\"]" "$CODE" \
  | sed -E "s/type:\s*['\"]([^'\"]+)['\"].*/\1/" \
  | sort -u
)"

# Extract message type headers from docs: #### `type_name`
doc_types="$(
  grep -oE '####\s+`[a-z_]+`' "$DOC" \
  | sed -E 's/####\s+`([^`]+)`.*/\1/' \
  | sort -u
)"

# Compare
missing_in_docs="$(comm -23 <(echo "$code_types") <(echo "$doc_types") || true)"
extra_in_docs="$(comm -13 <(echo "$code_types") <(echo "$doc_types") || true)"

errors=0

if [[ -n "$missing_in_docs" ]]; then
  echo "❌ Missing in docs/PROTOCOL.md:"
  echo "$missing_in_docs"
  errors=1
fi

if [[ -n "$extra_in_docs" ]]; then
  echo "❌ Present in docs/PROTOCOL.md but not in packages/shared/protocol.ts:"
  echo "$extra_in_docs"
  errors=1
fi

if [[ $errors -eq 1 ]]; then
  exit 1
fi

echo "✅ Protocol docs match packages/shared/protocol.ts"
