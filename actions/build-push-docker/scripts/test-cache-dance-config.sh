#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE_SCRIPT="${SCRIPT_DIR}/validate-cache-dance-config.sh"

echo "===== Testing build-push-docker cache dance configuration ====="

echo "Test 1: Cache dance disabled (default)"
"$VALIDATE_SCRIPT" "false" ""
echo "Test 1 passed."

echo "Test 2: Cache dance enabled with missing cache-map (should fail)"
if "$VALIDATE_SCRIPT" "true" ""; then
  echo "FAIL: Expected failure when cache-map is missing"
  exit 1
else
  echo "Test 2 passed (failed as expected)."
fi

echo "Test 3: Cache dance enabled with invalid JSON cache-map (should fail)"
if "$VALIDATE_SCRIPT" "true" "invalid-json"; then
  echo "FAIL: Expected failure when cache-map is invalid JSON"
  exit 1
else
  echo "Test 3 passed (failed as expected)."
fi

echo "Test 4: Cache dance enabled with valid JSON cache-map"
VALID_MAP='{"go-mod-cache": "/go/pkg/mod", "go-build-cache": "/root/.cache/go-build"}'
"$VALIDATE_SCRIPT" "true" "$VALID_MAP"
echo "Test 4 passed."

echo "All cache dance configuration tests completed successfully."
