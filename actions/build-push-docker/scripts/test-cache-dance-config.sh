#!/bin/bash
set -e

echo "===== Testing build-push-docker cache dance configuration ====="

# Helper script/function to test cache dance inputs validation
validate_cache_dance_config() {
  local cache_dance="$1"
  local cache_map="$2"

  if [ "$cache_dance" = "true" ]; then
    if [ -z "$cache_map" ]; then
      echo "ERROR: cache-dance-cache-map is required when cache-dance is true."
      return 1
    fi
    # Check if cache_map is valid JSON or non-empty string
    if ! echo "$cache_map" | jq . >/dev/null 2>&1; then
      echo "ERROR: cache-dance-cache-map must be valid JSON."
      return 1
    fi
    echo "VALID: cache-dance enabled with valid cache-map"
    return 0
  else
    echo "VALID: cache-dance disabled"
    return 0
  fi
}

echo "Test 1: Cache dance disabled (default)"
validate_cache_dance_config "false" ""
echo "Test 1 passed."

echo "Test 2: Cache dance enabled with missing cache-map (should fail)"
if validate_cache_dance_config "true" ""; then
  echo "FAIL: Expected failure when cache-map is missing"
  exit 1
else
  echo "Test 2 passed (failed as expected)."
fi

echo "Test 3: Cache dance enabled with invalid JSON cache-map (should fail)"
if validate_cache_dance_config "true" "invalid-json"; then
  echo "FAIL: Expected failure when cache-map is invalid JSON"
  exit 1
else
  echo "Test 3 passed (failed as expected)."
fi

echo "Test 4: Cache dance enabled with valid JSON cache-map"
VALID_MAP='{"go-mod-cache": "/go/pkg/mod", "go-build-cache": "/root/.cache/go-build"}'
validate_cache_dance_config "true" "$VALID_MAP"
echo "Test 4 passed."

echo "All cache dance configuration tests completed successfully."
