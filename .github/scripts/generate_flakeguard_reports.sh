#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------------------
# Ensure flakeguard is on the PATH (assuming installed via 'go install')
# ------------------------------------------------------------------------------
export PATH="$PATH:$(go env GOPATH)/bin"

# ------------------------------------------------------------------------------
# Required environment variables
# ------------------------------------------------------------------------------
: "${MAIN_RESULTS_DIR:?Environment variable MAIN_RESULTS_DIR must be set}"
: "${RERUN_RESULTS_DIR:?Environment variable RERUN_RESULTS_DIR must be set}"
: "${MAIN_REPORT_OUTPUT_PATH:?Environment variable MAIN_REPORT_OUTPUT_PATH must be set}"
: "${RERUN_REPORT_OUTPUT_PATH:?Environment variable RERUN_REPORT_OUTPUT_PATH must be set}"
: "${GH_INPUTS_MAX_PASS_RATIO:?Environment variable GH_INPUTS_MAX_PASS_RATIO must be set}"
: "${GITHUB_WORKSPACE:?Environment variable GITHUB_WORKSPACE must be set}"
: "${GITHUB_REPOSITORY:?Environment variable GITHUB_REPOSITORY must be set}"
: "${GITHUB_WORKFLOW:?Environment variable GITHUB_WORKFLOW must be set}"
: "${GITHUB_SERVER_URL:?Environment variable GITHUB_SERVER_URL must be set}"
: "${GITHUB_RUN_ID:?Environment variable GITHUB_RUN_ID must be set}"

# If the branch name is passed in, we'll use it; otherwise fallback or leave empty
: "${GITHUB_HEAD_REF:=${GITHUB_REF_NAME:-}}"

# GITHUB_STEP_SUMMARY / GITHUB_OUTPUT can be defined by GitHub automatically,
# but if they're not set, we define a fallback.
: "${GITHUB_STEP_SUMMARY:=${GITHUB_WORKSPACE}/step_summary.txt}"
: "${GITHUB_OUTPUT:=${GITHUB_WORKSPACE}/github_output.txt}"

# ------------------------------------------------------------------------------
# Helper function: generate a Flakeguard test report for a given dir -> output file
# ------------------------------------------------------------------------------
generate_report() {
  local results_dir="$1"
  local output_path="$2"

  # Check if directory exists and is non-empty
  if [ -d "$results_dir" ] && [ -n "$(ls -A "$results_dir" 2>/dev/null || true)" ]; then
    echo "Generating Flakeguard report from '$results_dir' => '$output_path'..."

    flakeguard generate-test-report \
      --test-results-dir "$results_dir" \
      --output-path "$output_path" \
      --repo-path "$GITHUB_WORKSPACE" \
      --codeowners-path "$GITHUB_WORKSPACE/.github/CODEOWNERS" \
      --max-pass-ratio "$GH_INPUTS_MAX_PASS_RATIO" \
      --repo-url "https://github.com/$GITHUB_REPOSITORY" \
      --github-workflow-name "$GITHUB_WORKFLOW" \
      --github-workflow-run-url "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" \
      --branch-name "$GITHUB_HEAD_REF" \
      --head-sha "$(git rev-parse HEAD)" \
      --gen-report-id

    local exit_code=$?
    if [ "$exit_code" -eq 2 ]; then
      echo "ERROR: Flakeguard encountered an error generating results from '$results_dir'"
      echo "ERROR: Flakeguard encountered an error generating results from '$results_dir'" >> "$GITHUB_STEP_SUMMARY"
      exit 2
    elif [ "$exit_code" -ne 0 ]; then
      echo "ERROR: Flakeguard failed (exit=$exit_code) for '$results_dir'"
      exit "$exit_code"
    fi
  else
    echo "Directory '$results_dir' does not exist or is empty. Skipping."
  fi
}

# ------------------------------------------------------------------------------
# 1) Generate the "main" report
# ------------------------------------------------------------------------------
generate_report "$MAIN_RESULTS_DIR" "$MAIN_REPORT_OUTPUT_PATH"

# ------------------------------------------------------------------------------
# 2) Generate the "rerun" report
# ------------------------------------------------------------------------------
generate_report "$RERUN_RESULTS_DIR" "$RERUN_REPORT_OUTPUT_PATH"

# ------------------------------------------------------------------------------
# Print summary for each report (if it exists) and store in GITHUB_OUTPUT
# ------------------------------------------------------------------------------
if [ -f "$MAIN_REPORT_OUTPUT_PATH" ]; then
  echo -e "\nFlakeguard Summary from '$MAIN_REPORT_OUTPUT_PATH':"
  jq .summary_data "$MAIN_REPORT_OUTPUT_PATH" || true

  main_summary="$(jq -c '.summary_data' "$MAIN_REPORT_OUTPUT_PATH" 2>/dev/null || echo '{}')"
  echo "main_summary=$main_summary" >> "$GITHUB_OUTPUT"
fi

if [ -f "$RERUN_REPORT_OUTPUT_PATH" ]; then
  echo -e "\nFlakeguard Summary from '$RERUN_REPORT_OUTPUT_PATH':"
  jq .summary_data "$RERUN_REPORT_OUTPUT_PATH" || true

  rerun_summary="$(jq -c '.summary_data' "$RERUN_REPORT_OUTPUT_PATH" 2>/dev/null || echo '{}')"
  echo "rerun_summary=$rerun_summary" >> "$GITHUB_OUTPUT"
fi

echo "All done."
exit 0
