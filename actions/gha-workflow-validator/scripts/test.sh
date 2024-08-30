#!/usr/bin/env bash

pnpm nx build gha-workflow-validator

export GITHUB_TOKEN="test"
export GITHUB_REPOSITORY="smartcontractkit/.github"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/gha-workflow-validator/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_VALIDATE_DIFF_ONLY="false"
export INPUT_VALIDATE_RUNNERS="false"
export INPUT_VALIDATE_ACTION_REFS="false"
export INPUT_VALIDATE_ACTION_NODE_VERSIONS="false"
export INPUT_INCLUDE_ALL_ACTION_DEFINITIONS="true"
export INPUT_ROOT_DIRECTORY="./"

export CL_LOCAL_DEBUG="true"

node actions/gha-workflow-validator/dist/index.js

echo "Summary Output: $tmp_file"
