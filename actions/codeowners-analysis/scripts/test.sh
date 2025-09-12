#!/usr/bin/env bash

pnpm nx build codeowners-analysis

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/codeowners-analysis/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_DIRECTORY="/Users/erik/Documents/repos/chainlink"
export CL_LOCAL_DEBUG="true"

node actions/codeowners-analysis/dist/index.js

echo "Summary Output: $tmp_file"
cat "$tmp_file"
