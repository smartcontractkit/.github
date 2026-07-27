#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVE_SCRIPT="${SCRIPT_DIR}/resolve-cache-settings.sh"

echo "===== Testing build-push-docker cache mode resolution ====="

parse_val() {
  local output="$1"
  local key="$2"
  echo "$output" | grep "^${key}=" | cut -d'=' -f2
}

echo "Test 1: Default cache-mode=auto on push event (save=true, restore=false)"
RES=$("$RESOLVE_SCRIPT" "auto" "push")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "false" ] || (echo "FAIL: expected restore=false, got $RES_RESTORE" && exit 1)
echo "Test 1 passed."

echo "Test 2: Default cache-mode=auto on pull_request event (save=false, restore=true)"
RES=$("$RESOLVE_SCRIPT" "auto" "pull_request")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "false" ] || (echo "FAIL: expected save=false, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 2 passed."

echo "Test 3: cache-mode=read-write on pull_request event (save=true, restore=true)"
RES=$("$RESOLVE_SCRIPT" "read-write" "pull_request")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 3 passed."

echo "Test 4: cache-mode=off on push event (save=false, restore=false)"
RES=$("$RESOLVE_SCRIPT" "off" "push")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "false" ] || (echo "FAIL: expected save=false, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "false" ] || (echo "FAIL: expected restore=false, got $RES_RESTORE" && exit 1)
echo "Test 4 passed."

echo "Test 5: cache-mode=read-only on push event (save=false, restore=true)"
RES=$("$RESOLVE_SCRIPT" "read-only" "push")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "false" ] || (echo "FAIL: expected save=false, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 5 passed."

echo "Test 6: cache-mode=write-only on pull_request event (save=true, restore=false)"
RES=$("$RESOLVE_SCRIPT" "write-only" "pull_request")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "false" ] || (echo "FAIL: expected restore=false, got $RES_RESTORE" && exit 1)
echo "Test 6 passed."

echo "All cache mode resolution tests completed successfully."
