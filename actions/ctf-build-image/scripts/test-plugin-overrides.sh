#!/bin/bash
set -e

echo "===== Testing plugin-overrides.sh ====="
export DRY_RUN=true

# Create a temporary manifest file for testing
TEMP_MANIFEST=$(mktemp)
cat > "$TEMP_MANIFEST" << EOF
plugins:
  cosmos:
    - gitRef: "old-cosmos-ref"
      modulePath: "github.com/smartcontractkit/chainlink-cosmos"
  solana:
    - gitRef: "old-solana-ref"
      modulePath: "github.com/smartcontractkit/chainlink-solana"
  starknet:
    - gitRef: "old-starknet-ref"
      modulePath: "github.com/smartcontractkit/chainlink-starknet"
EOF

# Test 1: Dry run with valid input
echo "Test 1: Dry run with valid input"
export PLUGIN_OVERRIDES="cosmos=new-cosmos-ref
solana=new-solana-ref
starknet=new-starknet-ref"
export PLUGINS_MANIFEST_PATH="$TEMP_MANIFEST"

echo "Initial manifest:"
cat "$TEMP_MANIFEST"
echo "Running with overrides:"
echo "$PLUGIN_OVERRIDES"
./plugin-overrides.sh
echo "Manifest after dry run (should be unchanged):"
cat "$TEMP_MANIFEST"
echo "Test 1 completed."
echo

# Test 2: Real run with valid input
echo "Test 2: Real run with valid input"
export PLUGIN_OVERRIDES="cosmos=new-cosmos-ref
solana=new-solana-ref"
./plugin-overrides.sh
echo "Test 2 completed."
echo

# Test 3: Non-existent plugin
echo "Test 3: Non-existent plugin"
export PLUGIN_OVERRIDES="non-existent-plugin=some-ref"
./plugin-overrides.sh
echo "Test 3 completed."
echo

# Test 4: Empty overrides
echo "Test 4: Empty overrides"
export PLUGIN_OVERRIDES=""
./plugin-overrides.sh
echo "Test 4 completed."
echo

# Clean up
rm "$TEMP_MANIFEST"
echo "Temporary manifest file removed."

echo "All tests for update-plugin-manifest.sh completed."
