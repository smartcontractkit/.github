#!/bin/bash
set -e

echo "===== Testing ctf-build-image cache event overrides ====="

# Helper function to evaluate cache save decision logic
resolve_save_cache() {
  local input_val="$1"
  local event_name="$2"

  if [ -n "$input_val" ]; then
    echo "$input_val"
  else
    if [ "$event_name" = "schedule" ] || [ "$event_name" = "push" ]; then
      echo "true"
    else
      echo "false"
    fi
  fi
}

# Helper function to evaluate cache restore decision logic
resolve_restore_cache() {
  local input_val="$1"
  local event_name="$2"

  if [ -n "$input_val" ]; then
    echo "$input_val"
  else
    if [ "$event_name" != "schedule" ] && [ "$event_name" != "push" ]; then
      echo "true"
    else
      echo "false"
    fi
  fi
}

echo "Test 1: Default behavior on push event (save=true, restore=false)"
RES_SAVE=$(resolve_save_cache "" "push")
RES_RESTORE=$(resolve_restore_cache "" "push")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "false" ] || (echo "FAIL: expected restore=false, got $RES_RESTORE" && exit 1)
echo "Test 1 passed."

echo "Test 2: Default behavior on pull_request event (save=false, restore=true)"
RES_SAVE=$(resolve_save_cache "" "pull_request")
RES_RESTORE=$(resolve_restore_cache "" "pull_request")
[ "$RES_SAVE" = "false" ] || (echo "FAIL: expected save=false, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 2 passed."

echo "Test 3: Override save cache on pull_request event (save=true)"
RES_SAVE=$(resolve_save_cache "true" "pull_request")
RES_RESTORE=$(resolve_restore_cache "" "pull_request")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 3 passed."

echo "Test 4: Override restore cache on push event (restore=true)"
RES_SAVE=$(resolve_save_cache "" "push")
RES_RESTORE=$(resolve_restore_cache "true" "push")
[ "$RES_SAVE" = "true" ] || (echo "FAIL: expected save=true, got $RES_SAVE" && exit 1)
[ "$RES_RESTORE" = "true" ] || (echo "FAIL: expected restore=true, got $RES_RESTORE" && exit 1)
echo "Test 4 passed."

echo "Test 5: Forward cache-dance inputs"
resolve_cache_dance_forwarding() {
  local dance="$1"
  local map="$2"
  echo "dance=$dance,map=$map"
}
FORWARD=$(resolve_cache_dance_forwarding "true" '{"go-mod-cache": "/go/pkg/mod"}')
[ "$FORWARD" = 'dance=true,map={"go-mod-cache": "/go/pkg/mod"}' ] || (echo "FAIL: expected dance forwarding match" && exit 1)
echo "Test 5 passed."

echo "All cache event override and dance forwarding tests completed successfully."
