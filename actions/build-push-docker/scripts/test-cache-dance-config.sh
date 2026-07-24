#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE_SCRIPT="${SCRIPT_DIR}/validate-cache-dance-config.sh"

echo "===== Testing build-push-docker cache dance configuration (Option 1) ====="

parse_val() {
  local output="$1"
  local key="$2"
  echo "$output" | grep "^${key}=" | cut -d'=' -f2
}

echo "Test 1: Default - no cache-dance and no cache-map"
RES=$("$VALIDATE_SCRIPT" "" "")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "false" ] || (echo "FAIL: expected cache-dance=false, got $DANCE" && exit 1)
echo "Test 1 passed."

echo "Test 2: Implicit enable - cache-map provided without explicit cache-dance flag"
VALID_MAP='{"go-mod-cache": "/go/pkg/mod"}'
RES=$("$VALIDATE_SCRIPT" "" "$VALID_MAP")
DANCE=$(parse_val "$RES" "cache-dance")
MAP=$(parse_val "$RES" "cache-map")
[ "$DANCE" = "true" ] || (echo "FAIL: expected cache-dance=true, got $DANCE" && exit 1)
[ "$MAP" = "$VALID_MAP" ] || (echo "FAIL: expected cache-map match" && exit 1)
echo "Test 2 passed."

echo "Test 3: Invalid JSON in cache-map (should fail)"
if "$VALIDATE_SCRIPT" "" "invalid-json"; then
  echo "FAIL: Expected failure when cache-map is invalid JSON"
  exit 1
else
  echo "Test 3 passed (failed as expected)."
fi

echo "Test 4: Explicit cache-dance=false overrides non-empty cache-map"
RES=$("$VALIDATE_SCRIPT" "false" "$VALID_MAP")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "false" ] || (echo "FAIL: expected cache-dance=false when explicitly disabled, got $DANCE" && exit 1)
echo "Test 4 passed."

echo "Test 5: Explicit cache-dance=true with missing cache-map (should fail)"
if "$VALIDATE_SCRIPT" "true" ""; then
  echo "FAIL: Expected failure when cache-dance=true with missing cache-map"
  exit 1
else
  echo "Test 5 passed (failed as expected)."
fi

echo "Test 6: Backward compatibility with CACHE_DANCE_CACHE_MAP env var"
RES=$(CACHE_DANCE_CACHE_MAP="$VALID_MAP" "$VALIDATE_SCRIPT" "" "")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "true" ] || (echo "FAIL: expected cache-dance=true from env var fallback, got $DANCE" && exit 1)
echo "Test 6 passed."

echo "All cache dance configuration tests completed successfully."
