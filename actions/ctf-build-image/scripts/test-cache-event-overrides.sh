#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOLVE_SCRIPT="${SCRIPT_DIR}/resolve-cache-settings.sh"

echo "===== Testing ctf-build-image cache event overrides ====="

parse_val() {
  local output="$1"
  local key="$2"
  echo "$output" | grep "^${key}=" | cut -d'=' -f2
}

echo "Test 1: Default behavior on push event (save=true, restore=false)"
RES=$("$RESOLVE_SCRIPT" "" "" "push")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "false" ] || (echo "FAIL: expected restore=false, got $RES_RESTORE" && exit 1)
echo "Test 1 passed."

echo "Test 2: Default behavior on pull_request event (save=false, restore=true)"
RES=$("$RESOLVE_SCRIPT" "" "" "pull_request")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "false" ] || (echo "FAIL: expected save=false, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 2 passed."

echo "Test 3: Override save cache on pull_request event (save=true)"
RES=$("$RESOLVE_SCRIPT" "true" "" "pull_request")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 3 passed."

echo "Test 4: Override restore cache on push event (restore=true)"
RES=$("$RESOLVE_SCRIPT" "" "true" "push")
RES_SAVE=$(parse_val "$RES" "save-cache")
RES_RESTORE=$(parse_val "$RES" "restore-cache")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 4 passed."

echo "All cache event override tests completed successfully."
