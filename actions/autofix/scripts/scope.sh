#!/usr/bin/env bash

# Runs before anything the pull request controls. Fails if files in PATHS are
# already changed, since they'd be committed as fixes. Then decides whether to
# skip the fixers: on a pull request that changed no file in PATHS there's
# nothing for them to fix. Anything else runs them.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

ALWAYS="${ALWAYS:-false}"
PR_BASE_SHA="${PR_BASE_SHA:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"

dirty="$(git status --porcelain --untracked-files=all -- "${paths[@]}")"
if [[ -n "${dirty}" ]]; then
  echo "::error::Files in ${paths[*]} were changed before autofix ran, and would be committed as its fixes:%0A${dirty//$'\n'/%0A}"
  exit 1
fi

skip() {
  echo "skip=$1" | tee -a "$GITHUB_OUTPUT"
  exit 0
}

if [[ "${ALWAYS}" == "true" || -z "${PR_BASE_SHA}" || -z "${PR_HEAD_SHA}" ]]; then
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

matched="$(jq -r '.files[] | .filename, (.previous_filename // empty)' <<<"${compare}" | in_paths)"
if [[ -z "${matched}" ]]; then
  echo "::notice::The pull request changed no files in ${paths[*]}, skipping."
  skip true
fi
skip false
