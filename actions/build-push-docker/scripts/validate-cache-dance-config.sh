#!/bin/bash
set -e

# Validates cache-dance configuration inputs.
# Emits: cache-dance=true, cache-map=<compact JSON or empty>
# An empty cache-map tells buildkit-cache-dance to auto-discover mounts from the Dockerfile.
CACHE_MAP="${1:-${CACHE_MAP}}"
if [ -z "$CACHE_MAP" ]; then
  CACHE_MAP="${CACHE_DANCE_CACHE_MAP}"
fi

# Explicit cache-map: validates JSON and passes it to buildkit-cache-dance.
if [ -n "$CACHE_MAP" ]; then
  if ! command -v jq >/dev/null 2>&1; then
    echo "::error::'jq' command not found; required to validate cache-map JSON."
    exit 1
  fi
  if ! COMPACT_MAP=$(echo "$CACHE_MAP" | jq -c . 2>/dev/null); then
    echo "::error::cache-map must be valid JSON."
    exit 1
  fi
  echo "cache-dance=true"
  echo "cache-map=${COMPACT_MAP}"
  exit 0
fi

# Default: auto-discover mounts from Dockerfile.
echo "cache-dance=true"
echo "cache-map="
