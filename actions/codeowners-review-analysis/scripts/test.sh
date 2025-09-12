#!/usr/bin/env bash

pnpm nx build codeowners-review-analysis

export GITHUB_TOKEN=$(gh auth token)
# export GITHUB_REPOSITORY="smartcontractkit/chainlink"
export GITHUB_REPOSITORY="smartcontractkit/releng-test"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/codeowners-review-analysis/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_POST_COMMENT="false"
export CL_LOCAL_DEBUG="true"

node actions/codeowners-review-analysis/dist/index.js

echo "Summary Output: $tmp_file"
# cat "$tmp_file"

echo "Writing to table.md"
cat "$tmp_file" > actions/codeowners-review-analysis/table.md
