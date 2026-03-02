#!/usr/bin/env bash

pnpm nx build apidiff-go

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"
export GITHUB_EVENT_NAME="workflow_dispatch"
export GITHUB_EVENT_PATH="actions/apidiff-go/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_REPOSITORY_ROOT="/Users/erik/Documents/repos/chainlink-common"
export INPUT_MODULE_DIRECTORY="."
export INPUT_BASE_REF_OVERRIDE="v0.10.0"
export INPUT_HEAD_REF_OVERRIDE="main"
export INPUT_ENFORCE_COMPATIBLE="true"
export INPUT_POST_COMMENT="false"
export INPUT_APIDIFF_VERSION="latest"
export INPUT_SUMMARY_URL="https://github.com/smartcontractkit/.github"

export CL_LOCAL_DEBUG="true"

node actions/apidiff-go/dist/index.js

echo "Writing to summary.md"
echo "$tmp_file"
cat "$tmp_file" > actions/apidiff-go/summary.md
