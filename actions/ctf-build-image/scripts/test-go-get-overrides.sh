#!/bin/bash
set -e

echo "===== Testing go-get-overrides.sh ====="

export DRY_RUN=true


# Test 1: Dry run with valid input
echo "Test 1: Dry run with valid input"
export GO_OVERRIDES="chainlink-solana=abc123
atlas=def456
chainlink-common=ghi789"
./go-get-overrides.sh
echo "Test 1 completed."
echo

# Test 2: Empty overrides
echo "Test 2: Empty overrides"
export GO_OVERRIDES=""
./go-get-overrides.sh
echo "Test 2 completed."
echo

# Test 3: Malformed input
echo "Test 3: Malformed input"
export GO_OVERRIDES="chainlink-solana=abc123
atlas=
invalid-line
chainlink-common=ghi789"
./go-get-overrides.sh
echo "Test 3 completed."
echo

echo "All tests for go-get-overrides.sh completed."
