#!/usr/bin/env bash

pnpm nx build get-refs-from-pr-body

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_ACTOR=$(gh api user --jq .login)
export GITHUB_REPOSITORY="smartcontractkit/chainlink-common"

export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/get-refs-from-pr-body/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

# Point at a mock that always returns 200 for local testing.
# For a real check, set SIGSCANNER_URL / SIGSCANNER_API_KEY to the real values.
export SIGSCANNER_URL="${SIGSCANNER_URL:-https://httpbin.org/status/200}"
export SIGSCANNER_API_KEY="${SIGSCANNER_API_KEY:-local-dev-key}"

export CL_LOCAL_DEBUG="true"

node actions/get-refs-from-pr-body/dist/index.js
