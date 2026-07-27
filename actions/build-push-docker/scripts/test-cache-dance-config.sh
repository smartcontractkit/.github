#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE_SCRIPT="${SCRIPT_DIR}/validate-cache-dance-config.sh"

echo "===== Testing build-push-docker cache dance configuration ====="

parse_val() {
  local output="$1"
  local key="$2"
  echo "$output" | grep "^${key}=" | cut -d'=' -f2
}

echo "Test 1: Default - empty cache-map disables cache-dance"
RES=$("$VALIDATE_SCRIPT" "")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "false" ] || (echo "FAIL: expected cache-dance=false, got $DANCE" && exit 1)
echo "Test 1 passed."

echo "Test 2: Implicit enable - cache-map provided"
VALID_MAP='{"go-mod-cache": "/go/pkg/mod"}'
RES=$("$VALIDATE_SCRIPT" "$VALID_MAP")
DANCE=$(parse_val "$RES" "cache-dance")
MAP=$(parse_val "$RES" "cache-map")
[ "$DANCE" = "true" ] || (echo "FAIL: expected cache-dance=true, got $DANCE" && exit 1)
[ "$MAP" = "$VALID_MAP" ] || (echo "FAIL: expected cache-map match" && exit 1)
echo "Test 2 passed."

echo "Test 3: Invalid JSON in cache-map (should fail)"
if "$VALIDATE_SCRIPT" "invalid-json"; then
  echo "FAIL: Expected failure when cache-map is invalid JSON"
  exit 1
else
  echo "Test 3 passed (failed as expected)."
fi

echo "Test 4: Environment variable CACHE_MAP support"
RES=$(CACHE_MAP="$VALID_MAP" "$VALIDATE_SCRIPT")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "true" ] || (echo "FAIL: expected cache-dance=true via env, got $DANCE" && exit 1)
echo "Test 4 passed."

echo "Test 5: Multiline JSON in cache-map (should fail)"
MULTILINE_MAP='{"go-mod-cache":
"/go/pkg/mod"}'
if "$VALIDATE_SCRIPT" "$MULTILINE_MAP"; then
  echo "FAIL: Expected failure when cache-map contains newlines"
  exit 1
else
  echo "Test 5 passed (failed as expected)."
fi

echo "Test 6: Fallback alias CACHE_DANCE_CACHE_MAP support"
RES=$(CACHE_DANCE_CACHE_MAP="$VALID_MAP" "$VALIDATE_SCRIPT")
DANCE=$(parse_val "$RES" "cache-dance")
[ "$DANCE" = "true" ] || (echo "FAIL: expected cache-dance=true via alias env, got $DANCE" && exit 1)
echo "Test 6 passed."

echo "All cache dance configuration tests completed successfully."

