#!/usr/bin/env bash
# Local test script for advanced-triggers.
#
# Usage:
#   cd /path/to/.github
#   bash actions/advanced-triggers/scripts/test.sh
#
# Requires:
#   - gh CLI authenticated (for GITHUB_TOKEN)
#   - pnpm nx build advanced-triggers (or run pnpm nx build advanced-triggers first)
#
# The script simulates a push event against a real repository so you can
# verify the trigger outputs without running in GitHub Actions.
#
# Override options (set before running):
#   GITHUB_EVENT_NAME  - event type (default: push; try: schedule, workflow_dispatch)
#   GITHUB_REPOSITORY  - target repo (default: smartcontractkit/chainlink)
#   REPOSITORY_ROOT    - path to a local checkout for git diff (push/merge_group events)
#   INPUT_FILE_SETS    - override file-sets YAML (default: scripts/file-sets.yml)
#   INPUT_TRIGGERS     - override triggers YAML (default: scripts/triggers.yml)

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"

pnpm nx build advanced-triggers

GITHUB_TOKEN=$(gh auth token)
export GITHUB_TOKEN
GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_ACTOR

export GITHUB_REPOSITORY="smartcontractkit/chainlink"

export GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-push}"
export GITHUB_EVENT_PATH="actions/advanced-triggers/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"
export GITHUB_OUTPUT="$tmp_file"

# When CL_LOCAL_DEBUG=true, inputs are read from INPUT_<LOCALPARAMETER> env vars
# instead of INPUT_<PARAMETER> env vars. See src/run-inputs.ts for the mapping.
export CL_LOCAL_DEBUG="true"

export INPUT_REPOSITORY_ROOT="${REPOSITORY_ROOT:-$HOME/Documents/repos/chainlink}"

# File-sets: named pattern groups referenced by triggers.
# Override by setting INPUT_FILE_SETS in your shell before running.
export INPUT_FILE_SETS="${INPUT_FILE_SETS:-$(cat "$SCRIPT_DIR/file-sets.yml")}"

# Triggers: what jobs should run and under what conditions.
# Override by setting INPUT_TRIGGERS in your shell before running.
export INPUT_TRIGGERS="${INPUT_TRIGGERS:-$(cat "$SCRIPT_DIR/triggers.yml")}"

echo "Event: $GITHUB_EVENT_NAME"
echo ""

node actions/advanced-triggers/dist/index.js

echo ""
echo "--- GITHUB_OUTPUT ---"
cat "$tmp_file"
