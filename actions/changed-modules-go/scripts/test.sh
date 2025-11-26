#!/usr/bin/env bash

pnpm nx build changed-modules-go

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"

export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/changed-modules-go/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_REPOSITORY_ROOT="$HOME/Documents/repos/chainlink"
export INPUT_FILE_PATTERNS='**/*.go,**/go.mod,**/go.sum'
export INPUT_MODULE_PATTERNS='**,!core/scripts/cre/environment/examples/workflows/**'
export INPUT_NO_CHANGE_BEHAVIOUR="all"
export CL_LOCAL_DEBUG="true"

node actions/changed-modules-go/dist/index.js

# echo "Summary Output: $tmp_file"
# cat "$tmp_file"
# echo "Writing to table.md"
# cat "$tmp_file" > actions/changed-modules-go/table.md
