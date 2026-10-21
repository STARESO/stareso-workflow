#!/usr/bin/env bash
# Proves that windowed runs never show on the main screen and stay silent (guide §5).
# Runs a screenshot of the main scene and the off-screen probe under a window watcher, then fails if
# any Godot window was visible on the main screen or if the audio driver was not Dummy.
# Usage: bash tools/verify_offscreen.sh   (Windows only: the watcher is a PowerShell script)
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
TMP="$(mktemp -d)"
TMPW="$(cd "$TMP" && pwd -W)"
trap 'rm -rf "$TMP"' EXIT
MAIN_SCENE="$(grep -oE 'run/main_scene="[^"]+"' project.godot | cut -d'"' -f2)"

powershell -NoProfile -ExecutionPolicy Bypass -File "$(pwd -W)/tools/watch_windows.ps1" \
	-Log "$TMPW/watch.log" -StopFile "$TMPW/stop.flag" -MaxSeconds 400 &
WATCHER=$!
sleep 2
mkdir -p tools/art/out
bash tools/screenshot.sh --scene="$MAIN_SCENE" --out=tools/art/out/verify_offscreen.jpg > "$TMP/shot.log"
bash tools/windowed.sh res://tools/offscreen_probe.gd > "$TMP/probe.log"
sleep 1
touch "$TMP/stop.flag"
wait "$WATCHER"
rm -f tools/art/out/verify_offscreen.jpg

grep -v "^.watch" "$TMP/watch.log"
grep -E "SCREENSHOT" "$TMP/shot.log"
grep -E "PROBE" "$TMP/probe.log"
FAIL=0
grep -q " MAIN$" "$TMP/watch.log" && { echo "OFFSCREEN FAIL a Godot window was visible on the main screen"; FAIL=1; }
grep -q "SCREENSHOT OK" "$TMP/shot.log" || { echo "OFFSCREEN FAIL the screenshot did not succeed"; FAIL=1; }
grep -q "audio_driver=Dummy" "$TMP/probe.log" || { echo "OFFSCREEN FAIL the audio driver was not Dummy"; FAIL=1; }
grep -q " SECONDARY$" "$TMP/watch.log" && echo "note: a window showed briefly on the secondary screen (expected: about one frame)"
[ "$FAIL" -eq 0 ] && echo "OFFSCREEN PASS"
exit "$FAIL"
