#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GO_SCRIPT="${SCRIPT_DIR}/go-get-overrides.sh"

echo "===== Testing go-get-overrides.sh ====="

export DRY_RUN=true

# Test 1: Dry run with valid input
echo "Test 1: Dry run with valid input"
export GO_OVERRIDES="github.com/smartcontractkit/chainlink-solana=abc123
github.com/smartcontractkit/atlas=def456"
"$GO_SCRIPT"
echo "Test 1 completed."
echo

# Test 2: Empty overrides
echo "Test 2: Empty overrides"
export GO_OVERRIDES=""
"$GO_SCRIPT"
echo "Test 2 completed."
echo

# Test 3: Malformed input
echo "Test 3: Malformed input"
export GO_OVERRIDES="github.com/smartcontractkit/chainlink-solana=abc123
atlas=
invalid-line"
"$GO_SCRIPT"
echo "Test 3 completed."
echo

# Test 4: Disallowed module override triggers failure
echo "Test 4: Disallowed module override triggers failure"
export GO_OVERRIDES="github.com/evil/pkg=abc123
github.com/smartcontractkit/chainlink-solana=def456"
if "$GO_SCRIPT"; then
  echo "Test 4 failed: expected script to fail on unauthorized module"
  exit 1
fi
echo "Test 4 completed."
echo

echo "All tests for go-get-overrides.sh completed."
