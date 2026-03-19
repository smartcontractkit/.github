#!/usr/bin/env bash
# Local test script for changed-files-filter.
#
# Usage:
#   cd /path/to/.github
#   bash actions/changed-files-filter/scripts/test.sh
#
# Requires:
#   - gh CLI authenticated (for GITHUB_TOKEN)
#   - pnpm nx build changed-files-filter (or run pnpm nx build changed-files-filter first)
#
# The script simulates a pull_request event against a real PR so you can
# verify the filter outputs without running in GitHub Actions.

set -euo pipefail

pnpm nx build changed-files-filter

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"

export GITHUB_EVENT_NAME="push"
export GITHUB_EVENT_PATH="actions/changed-files-filter/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"
export GITHUB_OUTPUT="$tmp_file"

# When CL_LOCAL_DEBUG=true, inputs are read from INPUT_<LOCALPARAMETER> env vars
# instead of INPUT_<PARAMETER> env vars. See src/run-inputs.ts for the mapping.
export CL_LOCAL_DEBUG="true"

export INPUT_REPOSITORY_ROOT="${REPOSITORY_ROOT:-$HOME/Documents/repos/chainlink}"

# Filters: read from the filters.yml file next to this script.
# You can override by setting INPUT_FILTERS directly in your shell before running.
export INPUT_FILTERS="${INPUT_FILTERS:-$(cat "$(dirname "$0")/filters.yml")}"

node actions/changed-files-filter/dist/index.js

echo ""
echo "--- GITHUB_OUTPUT ---"
cat "$tmp_file"
