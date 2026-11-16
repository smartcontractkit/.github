#!/usr/bin/env bash

# Writes the issues golangci-lint couldn't fix, read from its output in $1, to
# the job summary as a table linking each to its line. GitHub only annotates 10
# errors per step, and only inline on files in the pull request's diff, so the
# summary is where all of them show.
#
# Paths in the output are relative to the repository root. HEAD_SHA is the
# commit to link to.

set -euo pipefail

# The same lines the problem matcher annotates.
issue='^([^[:space:]:][^:]*):([0-9]+):([0-9]+:)? (.+) \(([[:alnum:]_-]+)\)$'

rows=()
while IFS= read -r line; do
  if [[ "${line}" =~ ${issue} ]]; then
    file="${BASH_REMATCH[1]}"
    lineno="${BASH_REMATCH[2]}"
    message="${BASH_REMATCH[4]//|/\\|}"
    linter="${BASH_REMATCH[5]}"
    rows+=("| [${file}:${lineno}](${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/${HEAD_SHA}/${file}#L${lineno}) | ${linter} | ${message} |")
  fi
done <"$1"

if [[ ${#rows[@]} -eq 0 ]]; then
  exit 0
fi

{
  echo "### golangci-lint: ${#rows[@]} issues autofix can't fix"
  echo
  echo "| Location | Linter | Issue |"
  echo "| --- | --- | --- |"
  printf '%s\n' "${rows[@]}"
} >>"${GITHUB_STEP_SUMMARY}"
