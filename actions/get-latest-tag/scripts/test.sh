#!/usr/bin/env bash

pnpm nx build get-latest-tag

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"

export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/get-latest-tag/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_REPOSITORY="smartcontractkit/chainlink-common"
export INPUT_TAG_PREFIX="keystore/v"
export CL_LOCAL_DEBUG="true"

node actions/get-latest-tag/dist/index.js

# echo "Summary Output: $tmp_file"
# cat "$tmp_file"
# echo "Writing to table.md"
# cat "$tmp_file" > actions/get-latest-tag/table.md
