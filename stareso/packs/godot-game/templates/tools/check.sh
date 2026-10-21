#!/usr/bin/env bash
# The verification gate (guide §6, §7). Usage: bash tools/check.sh   (exits non-zero on failure)
# Stages: import, parse check of all scripts, smoke test of the live scenes, unit tests (all headless),
# then the windowed tests through tools/windowed.sh (off the main screen, silent). NO_WINDOW=1 skips them.
# KEEP_LOGS=1 keeps the temporary log folder.
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
G="${GODOT:?set GODOT to the Godot console binary (see AGENTS.md)}"
TMP="$(mktemp -d)"
[ "${KEEP_LOGS:-0}" = "1" ] || trap 'rm -rf "$TMP"' EXIT

# Known harmless lines, one regex per line, each with a comment saying why.
ALLOW="$TMP/allow.txt"
grep -vE '^[[:space:]]*(#|$)' tools/smoke_allowlist.txt > "$ALLOW" 2>/dev/null || true
PARSE_SKIP_DIRS='(^|/)(addons|_archive|node_modules)/'

FAILED=0
SUMMARY=()

bad_lines() {
	sed 's/\x1b\[[0-9;]*m//g' "$1" | grep -E 'ERROR|SCRIPT ERROR|Parse Error|Failed to load|^(PARSE FAIL|SMOKE FAIL|FAIL |TESTS FAIL)' | grep -vEf "$ALLOW" || true
}

finish_stage() {
	local name="$1" log="$2" rc="$3" bad
	bad="$(bad_lines "$log")"
	if [ "$rc" -ne 0 ] || [ -n "$bad" ]; then
		FAILED=1
		SUMMARY+=("FAIL  $name (exit code $rc)")
		echo "--- $name: failure details ---"
		[ -n "$bad" ] && echo "$bad" | head -20
		[ "$rc" -eq 124 ] && echo "(timed out)"
	else
		SUMMARY+=("PASS  $name")
	fi
}

START=$SECONDS

timeout 300 "$G" --headless --path . --import > "$TMP/import.log" 2>&1
finish_stage "import" "$TMP/import.log" $?

find autoload scenes resources tools -name '*.gd' 2>/dev/null | grep -vE "$PARSE_SKIP_DIRS" | sort \
	| sed 's#^#res://#' > "$TMP/parse_list.txt"
LIST_ABS="$(cd "$TMP" && pwd -W 2>/dev/null || pwd)/parse_list.txt"
timeout 300 "$G" --headless --path . --script res://tools/parse_check.gd -- "--list=$LIST_ABS" > "$TMP/parse.log" 2>&1
finish_stage "parse ($(wc -l < "$TMP/parse_list.txt") scripts)" "$TMP/parse.log" $?

timeout 300 "$G" --headless --path . --script res://tools/smoke.gd -- --test-user-dir > "$TMP/smoke.log" 2>&1
finish_stage "smoke" "$TMP/smoke.log" $?

timeout 600 "$G" --headless --path . --script res://tools/test_runner.gd -- --test-user-dir > "$TMP/tests.log" 2>&1
finish_stage "tests" "$TMP/tests.log" $?

# Tests that need a real window (touch controls, rendering) carry "windowed" in their file name.
if [ "${NO_WINDOW:-0}" != "1" ] && ls tools/tests/test_*windowed*.gd > /dev/null 2>&1; then
	bash tools/windowed.sh res://tools/test_runner.gd --filter=windowed > "$TMP/windowed.log" 2>&1
	finish_stage "windowed tests" "$TMP/windowed.log" $?
fi

echo "=============================="
printf '%s\n' "${SUMMARY[@]}"
if [ "$FAILED" -eq 0 ]; then
	echo "CHECK PASS ($((SECONDS - START)) s)"
else
	echo "CHECK FAIL ($((SECONDS - START)) s)"
	[ "${KEEP_LOGS:-0}" = "1" ] && echo "logs kept in $TMP"
fi
exit "$FAILED"
