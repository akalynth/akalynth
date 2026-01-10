#!/usr/bin/env bash
set -euo pipefail
case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
  mingw*|msys*|cygwin*|windowsnt*)
    echo "Windows is unsupported for Akalynth." >&2
    exit 1
    ;;
esac
exit 0
