#!/bin/bash
set -e

# Resolves docker save/restore cache settings given input overrides and GitHub event name.
# Usage: resolve-cache-settings.sh <docker-save-cache-input> <docker-restore-cache-input> <github-event-name>

SAVE_INPUT="${1:-${DOCKER_SAVE_CACHE_INPUT}}"
RESTORE_INPUT="${2:-${DOCKER_RESTORE_CACHE_INPUT}}"
EVENT_NAME="${3:-${GITHUB_EVENT_NAME}}"

if [ -n "$SAVE_INPUT" ]; then
  SAVE_CACHE="$SAVE_INPUT"
else
  if [ "$EVENT_NAME" = "schedule" ] || [ "$EVENT_NAME" = "push" ]; then
    SAVE_CACHE="true"
  else
    SAVE_CACHE="false"
  fi
fi

if [ -n "$RESTORE_INPUT" ]; then
  RESTORE_CACHE="$RESTORE_INPUT"
else
  if [ "$EVENT_NAME" != "schedule" ] && [ "$EVENT_NAME" != "push" ]; then
    RESTORE_CACHE="true"
  else
    RESTORE_CACHE="false"
  fi
fi

echo "save-cache=${SAVE_CACHE}"
echo "restore-cache=${RESTORE_CACHE}"
