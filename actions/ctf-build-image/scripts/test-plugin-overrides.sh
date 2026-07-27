#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SCRIPT="${SCRIPT_DIR}/plugin-overrides.sh"

echo "===== Testing plugin-overrides.sh ====="
export DRY_RUN=true

# Create a temporary manifest file matching chainlink plugins.public.yaml schema
TEMP_MANIFEST=$(mktemp)
trap 'rm -f "$TEMP_MANIFEST"' EXIT
cat > "$TEMP_MANIFEST" << EOF

plugins:
  cosmos:
    - gitRef: "old-cosmos-ref"
      moduleURI: "github.com/smartcontractkit/chainlink-cosmos"
  solana:
    - gitRef: "old-solana-ref"
      moduleURI: "github.com/smartcontractkit/chainlink-solana"
EOF

# Test 1: Dry run with valid input
echo "Test 1: Dry run with valid input"
export PLUGIN_OVERRIDES="cosmos=new-cosmos-ref
solana=new-solana-ref"
export PLUGINS_MANIFEST_PATH="$TEMP_MANIFEST"

"$PLUGIN_SCRIPT"
echo "Test 1 completed."
echo

# Test 2: Real run with valid input (if yq installed)
if command -v yq &>/dev/null; then
  echo "Test 2: Real run with valid input"
  unset DRY_RUN
  "$PLUGIN_SCRIPT"
  unset DRY_RUN
  export DRY_RUN=true
  echo "Updated manifest:"
  cat "$TEMP_MANIFEST"
  echo "Test 2 completed."
  echo
fi

# Test 3: Empty overrides
echo "Test 3: Empty overrides"
export PLUGIN_OVERRIDES=""
"$PLUGIN_SCRIPT"
echo "Test 3 completed."
echo

# Clean up
rm "$TEMP_MANIFEST"
echo "All tests for plugin-overrides.sh completed."
