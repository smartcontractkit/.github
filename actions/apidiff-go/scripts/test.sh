#!/usr/bin/env bash

pnpm nx build apidiff-go

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/apidiff-go/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_REPOSITORY_ROOT="/Users/erik/Documents/repos/chainlink-common"
export INPUT_MODULE_DIRECTORY="./pkg/chipingress"
export INPUT_BASE_REF_OVERRIDE="pkg/chipingress/v0.0.7"
export INPUT_HEAD_REF_OVERRIDE="pkg/chipingress/v0.0.8"
export INPUT_ENFORCE_COMPATIBLE="true"
export INPUT_POST_COMMENT="false"
export INPUT_APIDIFF_VERSION="latest"

export CL_LOCAL_DEBUG="true"

node actions/apidiff-go/dist/index.js

echo "Writing to summary.md"
echo "$tmp_file"
cat "$tmp_file" > actions/apidiff-go/summary.md
