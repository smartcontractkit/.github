#!/usr/bin/env bash

# Decides whether to skip the fixers: on a pull request that changed no file in
# PATHS there's nothing for them to fix. Anything else runs them.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

PR_BASE_SHA="${PR_BASE_SHA:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"

skip() {
  echo "skip=$1" | tee -a "$GITHUB_OUTPUT"
  exit 0
}

if [[ -z "${PR_BASE_SHA}" || -z "${PR_HEAD_SHA}" ]]; then
  skip false
fi

# The compare API lists the files the pull request changed (relative to the
# merge base) with only `contents: read`, up to 300 of them.
if ! compare="$(gh api "repos/${GITHUB_REPOSITORY}/compare/${PR_BASE_SHA}...${PR_HEAD_SHA}")"; then
  echo "::warning::Could not list the pull request's changed files, running the fixers anyway."
  skip false
fi
if [[ "$(jq '.files | length' <<<"${compare}")" -ge 300 ]]; then
  skip false
fi

# Match the changed files against the pathspecs with git itself, through a
# throwaway index, so deleted files and pathspec magic work too.
index="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/autofix-index.XXXXXX")"
rm -f "${index}"
trap 'rm -f "${index}"' EXIT
empty_blob="$(git hash-object -t blob /dev/null)"
jq -r '.files[] | .filename, (.previous_filename // empty)' <<<"${compare}" |
  while IFS= read -r file; do
    printf '100644 %s\t%s\n' "${empty_blob}" "${file}"
  done |
  GIT_INDEX_FILE="${index}" git update-index --index-info

matched="$(GIT_INDEX_FILE="${index}" git ls-files -- "${paths[@]}")"
if [[ -z "${matched}" ]]; then
  echo "::notice::The pull request changed no files in ${paths[*]}, skipping."
  skip true
fi
skip false
