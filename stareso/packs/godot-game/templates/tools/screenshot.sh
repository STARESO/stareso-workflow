#!/usr/bin/env bash
# Off-screen, silent screenshot (guide §5). Usage: bash tools/screenshot.sh --scene=res://... --out=<ignored folder>/x.jpg [more args]
# tools/screenshot.gd restores the minimized window, moves it to -20000,-20000, waits, saves the viewport
# as a JPG and checks the image size. Never launch screenshot.gd without this wrapper.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
G="${GODOT:?set GODOT to the Godot console binary (see AGENTS.md)}"
if [ -e override.cfg ]; then
	echo "SCREENSHOT FAIL override.cfg already exists in the project root (stale from a killed run?), remove it first" >&2
	exit 1
fi
trap 'rm -f override.cfg' EXIT
source tools/offscreen_override.sh
timeout 300 "$G" --path . --windowed --resolution 1280x720 --audio-driver Dummy \
	--script res://tools/screenshot.gd -- --test-user-dir "$@" 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E 'SCREENSHOT|ERROR|SCRIPT ERROR|Parse Error'
exit "${PIPESTATUS[0]}"
