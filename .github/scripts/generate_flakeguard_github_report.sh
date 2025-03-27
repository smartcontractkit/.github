#!/usr/bin/env bash
set -euo pipefail

# Fix flakeguard binary path
export PATH="$PATH:$(go env GOPATH)/bin"

# Ensure required environment variables are set
: "${GITHUB_REPOSITORY:?Environment variable GITHUB_REPOSITORY must be set}"
: "${GITHUB_RUN_ID:?Environment variable GITHUB_RUN_ID must be set}"
: "${GITHUB_HEAD_REF:?Environment variable GITHUB_HEAD_REF must be set}"
: "${GH_INPUTS_MAX_PASS_RATIO:?Environment variable GH_INPUTS_MAX_PASS_RATIO must be set}"
: "${FAILED_LOGS_URL:?Environment variable FAILED_LOGS_URL must be set}"
: "${MAIN_REPORT_PATH:?Environment variable MAIN_REPORT_PATH must be set}"
: "${SUMMARY_MD_PATH:?Environment variable SUMMARY_MD_PATH must be set}"

# Run flakeguard command
flakeguard generate-github-report \
  --flakeguard-report "${MAIN_REPORT_PATH}" \
  --summary-report-md-path "${SUMMARY_MD_PATH}" \
  --failed-logs-url "${FAILED_LOGS_URL:-}" \
  --github-repository "${GITHUB_REPOSITORY:-}" \
  --github-run-id "${GITHUB_RUN_ID:-}" \
  --current-branch "${GITHUB_HEAD_REF:-}" \
  --repo-url "https://github.com/${GITHUB_REPOSITORY:-}" \
  --action-run-id "${GITHUB_RUN_ID:-}" \
  --max-pass-ratio "${GH_INPUTS_MAX_PASS_RATIO:-}"

EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 2 ]; then
  echo "ERROR: Flakeguard encountered an error while generating reports"
  # Append the same message to the step summary
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "ERROR: Flakeguard encountered an error while generating reports" >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 2
fi

exit "$EXIT_CODE"
