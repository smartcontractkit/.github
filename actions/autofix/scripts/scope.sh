#!/usr/bin/env bash

# Runs before anything the pull request controls. Fails if files in PATHS are
# already changed, since they'd be committed as fixes. Then decides whether to
# skip the fixers: on a pull request that changed no file in PATHS there's
# nothing for them to fix. Anything else runs them. With CHANGED_ONLY, also
# outputs the changed files in PATHS for the Go fixers, when they're known and
# no file that can change every module's result was changed.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

ALWAYS="${ALWAYS:-false}"
CHANGED_ONLY="${CHANGED_ONLY:-false}"
GOLANGCI_LINT="${GOLANGCI_LINT:-false}"
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

if [[ -z "${PR_BASE_SHA}" || -z "${PR_HEAD_SHA}" ]]; then
  skip false
fi

if [[ "${ALWAYS}" == "true" && "${CHANGED_ONLY}" != "true" ]]; then
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

changed="$(jq -r '.files[] | .filename, (.previous_filename // empty)' <<<"${compare}")"
matched="$(in_paths <<<"${changed}")"

# Files that can change the result in every module, wherever they are: the
# workflows and actions that set autofix's inputs, the Go workspace, the
# golangci-lint configs, and ALL_PATHS.
all_paths=(.github/ go.work go.work.sum)
if [[ "${GOLANGCI_LINT}" == "true" ]]; then
  for ext in yml yaml toml json; do
    all_paths+=(":(glob)**/.golangci.${ext}")
  done
fi

while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  if [[ -n "${line}" ]]; then
    all_paths+=("${line}")
  fi
done <<<"${ALL_PATHS:-}"

if [[ "${CHANGED_ONLY}" == "true" ]]; then
  all_matched="$(in_paths "${all_paths[@]}" <<<"${changed}")"
  if [[ -n "${all_matched}" ]]; then
    echo "::notice::The pull request changed ${all_matched//$'\n'/, }, which can affect every module, fixing them all."
    CHANGED_ONLY=false
  fi
fi

if [[ "${CHANGED_ONLY}" == "true" ]]; then
  # File names come from the pull request, so the delimiter must be one it
  # can't guess.
  delimiter="EOF_$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  {
    echo "changed-files-known=true"
    echo "changed-files<<${delimiter}"
    if [[ -n "${matched}" ]]; then
      echo "${matched}"
    fi

    echo "${delimiter}"
  } | tee -a "$GITHUB_OUTPUT"
fi

if [[ -z "${matched}" && "${ALWAYS}" != "true" ]]; then
  echo "::notice::The pull request changed no files in ${paths[*]}, skipping."
  skip true
fi
skip false
