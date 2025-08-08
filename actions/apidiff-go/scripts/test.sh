#!/usr/bin/env bash

pnpm nx build apidiff-go

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/apidiff-go/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_DIRECTORY="/Users/erik/Documents/test-repos/chainlink-common"
export INPUT_GO_MOD_PATH="."
export INPUT_HEAD_REF="17115c3a4453e0347dae7f035bf94c959ca5bbda"
export INPUT_BASE_REF="182a3d1ef5af6c5e9a21bca84d904251847fc315"
export INPUT_ENFORCE_COMPATIBLE="true"

export CL_LOCAL_DEBUG="true"

node actions/apidiff-go/dist/index.js

echo "Summary Output: $tmp_file"
cat "$tmp_file"
