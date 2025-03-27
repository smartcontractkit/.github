#!/usr/bin/env bash
set -euo pipefail

# Ensure flakeguard is on PATH
export PATH="$PATH:$(go env GOPATH)/bin"

# ----------------------------------------------------------------------------
# Ensure required environment variables are set
# ----------------------------------------------------------------------------
: "${FLAKEGUARD_SPLUNK_ENDPOINT:?Environment variable FLAKEGUARD_SPLUNK_ENDPOINT must be set}"
: "${FLAKEGUARD_SPLUNK_HEC:?Environment variable FLAKEGUARD_SPLUNK_HEC must be set}"
: "${GITHUB_EVENT_NAME:?Environment variable GITHUB_EVENT_NAME must be set}"
: "${FAILED_LOGS_URL:?Environment variable FAILED_LOGS_URL must be set}"
: "${MAIN_REPORT_PATH:?Environment variable MAIN_REPORT_PATH must be set}"
# : "${RERUN_REPORT_PATH:?Environment variable RERUN_REPORT_PATH must be set}"

echo "Using Flakeguard Splunk Endpoint: $FLAKEGUARD_SPLUNK_ENDPOINT"
echo "Using GITHUB_EVENT_NAME: $GITHUB_EVENT_NAME"
echo "Failed Logs URL: $FAILED_LOGS_URL"
echo "Main report path: $MAIN_REPORT_PATH"
echo "Rerun report path: $RERUN_REPORT_PATH"

# ----------------------------------------------------------------------------
# Helper function: send a single report if it exists
# ----------------------------------------------------------------------------
send_report_to_splunk() {
  local report_path="$1"

  echo "Checking if report exists: $report_path"
  if [ -f "$report_path" ]; then
    echo "Sending report to Splunk: $report_path"
    flakeguard send-to-splunk \
      --report-path "$report_path" \
      --failed-logs-url "${FAILED_LOGS_URL}" \
      --splunk-url "${FLAKEGUARD_SPLUNK_ENDPOINT}" \
      --splunk-token "${FLAKEGUARD_SPLUNK_HEC}" \
      --splunk-event "${GITHUB_EVENT_NAME}"

    local exit_code=$?
    if [ "$exit_code" -ne 0 ]; then
      echo "ERROR: Flakeguard encountered an error sending report '$report_path' to Splunk"
      exit "$exit_code"
    fi
  else
    echo "File not found at '$report_path'. Skipping."
  fi
}

# ----------------------------------------------------------------------------
# Attempt to send the main and rerun reports
# ----------------------------------------------------------------------------
send_report_to_splunk "$MAIN_REPORT_PATH"
send_report_to_splunk "$RERUN_REPORT_PATH"

# ----------------------------------------------------------------------------
# If we get here, any existing reports were sent successfully
# ----------------------------------------------------------------------------
echo "All done!"
exit 0
