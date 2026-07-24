#!/bin/bash
set -e

# Resolves docker save/restore cache settings given cache-mode preset or input overrides.
# Usage: resolve-cache-settings.sh <cache-mode> <docker-save-cache-input> <docker-restore-cache-input> <github-event-name>

CACHE_MODE="${1:-${CACHE_MODE}}"
SAVE_INPUT="${2:-${DOCKER_SAVE_CACHE_INPUT}}"
RESTORE_INPUT="${3:-${DOCKER_RESTORE_CACHE_INPUT}}"
EVENT_NAME="${4:-${GITHUB_EVENT_NAME}}"

# Default to "auto" if cache-mode is un-specified
if [ -z "$CACHE_MODE" ]; then
  CACHE_MODE="auto"
fi

if [ -n "$SAVE_INPUT" ]; then
  SAVE_CACHE="$SAVE_INPUT"
else
  case "$CACHE_MODE" in
    read-write|write-only|true)
      SAVE_CACHE="true"
      ;;
    read-only|off|false)
      SAVE_CACHE="false"
      ;;
    auto|*)
      if [ "$EVENT_NAME" = "schedule" ] || [ "$EVENT_NAME" = "push" ]; then
        SAVE_CACHE="true"
      else
        SAVE_CACHE="false"
      fi
      ;;
  esac
fi

if [ -n "$RESTORE_INPUT" ]; then
  RESTORE_CACHE="$RESTORE_INPUT"
else
  case "$CACHE_MODE" in
    read-write|read-only|true)
      RESTORE_CACHE="true"
      ;;
    write-only|off|false)
      RESTORE_CACHE="false"
      ;;
    auto|*)
      if [ "$EVENT_NAME" != "schedule" ] && [ "$EVENT_NAME" != "push" ]; then
        RESTORE_CACHE="true"
      else
        RESTORE_CACHE="false"
      fi
      ;;
  esac
fi

echo "save-cache=${SAVE_CACHE}"
echo "restore-cache=${RESTORE_CACHE}"
