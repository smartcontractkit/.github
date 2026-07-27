#!/bin/bash
set -e

# Validates cache-dance configuration inputs.
# Positional argument $1: CACHE_MAP (JSON string)
# Or environment variable: CACHE_MAP
CACHE_MAP="${1:-${CACHE_MAP}}"
if [ -z "$CACHE_MAP" ]; then
  CACHE_MAP="${CACHE_DANCE_CACHE_MAP}"
fi

if [ -n "$CACHE_MAP" ]; then
  CACHE_DANCE="true"
  if [[ "$CACHE_MAP" == *$'\n'* ]]; then
    echo "::error::cache-map must be a single-line JSON string (no newlines), because it is written to \$GITHUB_OUTPUT."
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "::error::'jq' command not found; required to validate cache-map JSON."
    exit 1
  fi
  if ! echo "$CACHE_MAP" | jq . >/dev/null 2>&1; then
    echo "::error::cache-map must be valid JSON."
    exit 1
  fi
else
  CACHE_DANCE="false"
fi

echo "cache-dance=${CACHE_DANCE}"
echo "cache-map=${CACHE_MAP}"

