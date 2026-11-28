#!/usr/bin/env bash
set -euo pipefail

export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8

AICO_DEFAULT_MANAGEMENT_ROOT="management"
MGMT_ROOT="${AICO_MANAGEMENT_ROOT:-$AICO_DEFAULT_MANAGEMENT_ROOT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LAUNCHER="$REPO_ROOT/$MGMT_ROOT/scripts/_launcher.py"

if [ ! -f "$LAUNCHER" ]; then
    echo "Error: AIco launcher not found: $LAUNCHER" >&2
    exit 1
fi

if command -v uv >/dev/null 2>&1; then
    exec uv run "$LAUNCHER" "$@"
elif command -v python3 >/dev/null 2>&1; then
    exec python3 "$LAUNCHER" "$@"
elif command -v python >/dev/null 2>&1; then
    exec python "$LAUNCHER" "$@"
else
    echo "Error: Neither 'uv' nor Python 3.11+ ('python3'/'python') was found in PATH." >&2
    echo "Please install uv (https://docs.astral.sh/uv/) or Python 3.11+." >&2
    exit 1
fi
