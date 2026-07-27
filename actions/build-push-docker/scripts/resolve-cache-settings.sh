#!/bin/bash
set -e

# Resolves docker save/restore cache settings given cache-mode preset.
# Usage: resolve-cache-settings.sh <cache-mode> <github-event-name>

CACHE_MODE="${1:-${CACHE_MODE}}"
EVENT_NAME="${2:-${GITHUB_EVENT_NAME}}"

if [ -z "$CACHE_MODE" ]; then
  CACHE_MODE="auto"
fi

case "$CACHE_MODE" in
  read-write|true)
    SAVE_CACHE="true"
    RESTORE_CACHE="true"
    ;;
  read-only)
    SAVE_CACHE="false"
    RESTORE_CACHE="true"
    ;;
  write-only)
    SAVE_CACHE="true"
    RESTORE_CACHE="false"
    ;;
  off|false)
    SAVE_CACHE="false"
    RESTORE_CACHE="false"
    ;;
  auto|*)
    if [ "$EVENT_NAME" = "schedule" ] || [ "$EVENT_NAME" = "push" ]; then
      SAVE_CACHE="true"
      RESTORE_CACHE="false"
    else
      SAVE_CACHE="false"
      RESTORE_CACHE="true"
    fi
    ;;
esac

echo "save-cache=${SAVE_CACHE}"
echo "restore-cache=${RESTORE_CACHE}"
