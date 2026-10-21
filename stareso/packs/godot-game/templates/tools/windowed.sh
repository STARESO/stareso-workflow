#!/usr/bin/env bash
# Run a Godot --script entry point in a real window kept off the main screen and silent (guide §5).
# Usage: bash tools/windowed.sh res://tools/test_runner.gd [user args...]
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
G="${GODOT:?set GODOT to the Godot console binary (see AGENTS.md)}"
if [ -e override.cfg ]; then
	echo "WINDOWED FAIL override.cfg already exists in the project root (stale from a killed run?), remove it first" >&2
	exit 1
fi
trap 'rm -f override.cfg' EXIT
source tools/offscreen_override.sh
SCRIPT="$1"; shift
timeout 300 "$G" --path . --windowed --resolution 1280x720 --audio-driver Dummy --script "$SCRIPT" -- --test-user-dir "$@" 2>&1 | sed 's/\x1b\[[0-9;]*m//g'
exit "${PIPESTATUS[0]}"
