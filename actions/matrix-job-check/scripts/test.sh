#!/usr/bin/env bash

pnpm nx build matrix-job-check

export GITHUB_TOKEN=$(gh auth token)
export GITHUB_REPOSITORY="smartcontractkit/chainlink"
export GITHUB_EVENT_NAME="pull_request"
export GITHUB_EVENT_PATH="actions/matrix-job-check/scripts/payload.json"

tmp_file=$(mktemp)
export GITHUB_STEP_SUMMARY="$tmp_file"

export INPUT_WORKFLOW_RUN_ID="20179425622"
export INPUT_JOB_NAME_PREFIX="GolangCI Lint ("
export INPUT_ASSERT_JOBS_EXIST="true"
export INPUT_ASSERT_SUCCESSFUL="false"
export INPUT_ASSERT_NO_FAILURES="false"

export CL_LOCAL_DEBUG="true"

node actions/matrix-job-check/dist/index.js

# echo "Writing to summary.md"
# echo "$tmp_file"
# cat "$tmp_file" > actions/matrix-job-check/summary.md
