#!/usr/bin/env bash

# @actions/glob requires disallows any relative pathing
abspath() { cd "$1" && pwd; }

REPO_ROOT="$(git rev-parse --show-toplevel)"

pnpm nx build go-mod-validator

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="apps/go-mod-validator/scripts/payload.json"


tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_GITHUB_TOKEN="$GITHUB_TOKEN"
export INPUT_GO_MOD_DIR="${INPUT_GO_MOD_DIR:-$(abspath "${REPO_ROOT}/../chainlink-common")}"
export INPUT_DEP_PREFIX="github.com/smartcontractkit"
export CL_LOCAL_DEBUG="true"

node apps/go-mod-validator/dist/index.js

echo "Summary Output: $tmp_file"
# cat "$tmp_file"

echo "Writing to table.md"
cat "$tmp_file" > apps/go-mod-validator/table.md
