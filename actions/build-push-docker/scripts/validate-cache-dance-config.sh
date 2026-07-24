#!/bin/bash
set -e

# Validates cache-dance configuration inputs.
# Accepts positional arguments:
#   $1: CACHE_DANCE ("true" | "false" | "")
#   $2: CACHE_MAP (JSON string or path map)
# Or environment variables: CACHE_DANCE, CACHE_MAP, CACHE_DANCE_CACHE_MAP

EXPLICIT_DANCE="${1:-${CACHE_DANCE}}"
CACHE_MAP="${2:-${CACHE_MAP:-${CACHE_DANCE_CACHE_MAP}}}"

if [ -n "$CACHE_MAP" ]; then
  if [ "$EXPLICIT_DANCE" = "false" ]; then
    CACHE_DANCE="false"
  else
    CACHE_DANCE="true"
  fi
else
  if [ "$EXPLICIT_DANCE" = "true" ]; then
    echo "::error::cache-map (or cache-dance-cache-map) input is required when cache-dance is true."
    exit 1
  fi
  CACHE_DANCE="false"
fi

if [ "$CACHE_DANCE" = "true" ]; then
  if ! echo "$CACHE_MAP" | jq . >/dev/null 2>&1; then
    echo "::error::cache-map (or cache-dance-cache-map) must be valid JSON."
    exit 1
  fi
fi

echo "cache-dance=${CACHE_DANCE}"
echo "cache-map=${CACHE_MAP}"
