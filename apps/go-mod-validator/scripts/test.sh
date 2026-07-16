#!/usr/bin/env bash

# @actions/glob requires disallows any relative pathing
abspath() { cd "$1" && pwd; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
echo "Repo Root: $REPO_ROOT"

pnpm nx build go-mod-validator

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"
export GITHUB_EVENT_NAME="push"
export GITHUB_EVENT_PATH="apps/go-mod-validator/scripts/payload.json"


tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_GITHUB_TOKEN="$GITHUB_TOKEN"
export INPUT_GO_MOD_DIR="${INPUT_GO_MOD_DIR:-$(realpath "${REPO_ROOT}/../chainlink/")}"
echo INPUT_GO_MOD_DIR="$INPUT_GO_MOD_DIR"
export INPUT_DEP_PREFIX="github.com/smartcontractkit"
# export INPUT_REPO_BRANCH_EXCEPTIONS="smartcontractkit/chainlink-aptos:ogt/cherry-pick-revert-txm-duration-config-types-into-2-47-0-branch"
export INPUT_REPO_SHA_EXCEPTIONS="smartcontractkit/chainlink-aptos:c2a8d09e5b46c1c7815700f645a50caf8a466bda"
export CL_LOCAL_DEBUG="true"

node apps/go-mod-validator/dist/index.js

echo "Summary Output: $tmp_file"
# cat "$tmp_file"

echo "Writing to table.md"
cat "$tmp_file" > apps/go-mod-validator/table.md
