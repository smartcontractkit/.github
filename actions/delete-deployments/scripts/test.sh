#!/usr/bin/env bash

pnpm nx build delete-deployments

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"

export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/delete-deployments/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_REPOSITORY="smartcontractkit/chainlink"
export INPUT_ENVIRONMENT="integration"
export INPUT_REF="develop"
export INPUT_NUM_OF_PAGES="1"
export INPUT_STARTING_PAGE="2"
export INPUT_DRY_RUN="true"
export CL_LOCAL_DEBUG="true"

node actions/delete-deployments/dist/index.js

# echo "Summary Output: $tmp_file"
# cat "$tmp_file"
# echo "Writing to table.md"
# cat "$tmp_file" > actions/changed-modules-go/table.md
