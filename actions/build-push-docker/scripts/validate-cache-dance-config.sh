#!/bin/bash
set -e

# Validates cache-dance configuration inputs.
# Accepts arguments ($1: cache_dance, $2: cache_map) or environment variables (CACHE_DANCE, CACHE_MAP).

CACHE_DANCE="${1:-${CACHE_DANCE}}"
CACHE_MAP="${2:-${CACHE_MAP}}"

if [ "${CACHE_DANCE}" = "true" ]; then
  if [ -z "${CACHE_MAP}" ]; then
    echo "::error::cache-dance-cache-map input is required when cache-dance is true."
    exit 1
  fi
  if ! echo "${CACHE_MAP}" | jq . >/dev/null 2>&1; then
    echo "::error::cache-dance-cache-map must be valid JSON."
    exit 1
  fi
fi
