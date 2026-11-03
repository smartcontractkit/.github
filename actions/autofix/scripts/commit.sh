#!/usr/bin/env bash

# Commits the changes check.sh wrote to ARTIFACT_DIR to BRANCH, through the
# GitHub GraphQL API (createCommitOnBranch) so the commit is signed. Runs in a
# job that has the token to push but runs nothing the pull request controls,
# so the artifact is untrusted: every path in it must be a regular file in
# PATHS and outside .github.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

ARTIFACT_DIR="${ARTIFACT_DIR:?}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: autofix}"
BRANCH="${BRANCH:-}"
HEAD_SHA="${HEAD_SHA:-}"
PR_HEAD_REPO="${PR_HEAD_REPO:-}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-}"

fail() {
  echo "committed=false" | tee -a "$GITHUB_OUTPUT"
  echo "::error::$1"
  exit 1
}

if [[ -z "${GH_TOKEN:-}" ]]; then
  # Commits pushed with GITHUB_TOKEN don't trigger workflow runs, so checks
  # would never run on the autofix commit.
  fail "No github-token was given. Pass a GitHub App token, e.g. from setup-github-token."
elif [[ -n "${PR_HEAD_REPO}" && "${PR_HEAD_REPO}" != "${GITHUB_REPOSITORY}" ]]; then
  fail "The pull request is from a fork."
elif [[ -z "${BRANCH}" || -z "${HEAD_SHA}" ]]; then
  fail "No branch to commit to."
elif [[ "${BRANCH}" == "${DEFAULT_BRANCH}" || "${BRANCH}" == gh-readonly-queue/* ]]; then
  fail "'${BRANCH}' is the default branch or a merge queue branch."
fi

headline="${COMMIT_MESSAGE%%$'\n'*}"
body=""
if [[ "${COMMIT_MESSAGE}" == *$'\n'* ]]; then
  body="${COMMIT_MESSAGE#*$'\n'}"
  # Drop the blank line(s) separating the headline from the body.
  body="${body#"${body%%[!$'\n']*}"}"
fi
# Marks autofix commits, whatever their message, so autofix jobs recognize
# each other's commits.
trailer="Autofix: true"
if [[ -n "${body}" ]]; then
  body+=$'\n\n'
fi
body+="${trailer}"

files_dir="${ARTIFACT_DIR}/files"
if [[ ! -d "${files_dir}" || ! -f "${ARTIFACT_DIR}/deleted" ]]; then
  fail "The autofix artifact is incomplete."
fi
irregular="$(find "${files_dir}" -mindepth 1 ! -type f ! -type d)"
if [[ -n "${irregular}" ]]; then
  fail "The autofix artifact holds files that aren't regular files: ${irregular//$'\n'/, }"
fi

added="$(cd "${files_dir}" && find . -type f | sed 's|^\./||' | sort)"
deleted="$(sort -u "${ARTIFACT_DIR}/deleted")"
changed_files="$(printf '%s\n%s\n' "${added}" "${deleted}" | sed '/^$/d' | sort -u)"
if [[ -z "${changed_files}" ]]; then
  fail "The autofix artifact holds no changes."
fi

while IFS= read -r path; do
  case "/${path}/" in
    */../* | */./* | //*) fail "The autofix artifact holds an invalid path: ${path}" ;;
    /.git/* | /.github/*) fail "Autofix doesn't commit changes under .git or .github: ${path}" ;;
  esac
done <<<"${changed_files}"

outside="$(comm -23 <(echo "${changed_files}") <(in_paths <<<"${changed_files}" | sort -u))"
if [[ -n "${outside}" ]]; then
  fail "The autofix artifact changes files outside ${paths[*]}: ${outside//$'\n'/, }"
fi

tmp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
additions="$(mktemp "${tmp}/autofix-additions.XXXXXX")"
deletions="$(mktemp "${tmp}/autofix-deletions.XXXXXX")"
payload="$(mktemp "${tmp}/autofix-payload.XXXXXX")"
trap 'rm -f "${additions}" "${deletions}" "${payload}"' EXIT

while IFS= read -r path; do
  if [[ -n "${path}" ]]; then
    jq -n --arg path "${path}" --rawfile contents <(base64 <"${files_dir}/${path}" | tr -d '\n') \
      '{path: $path, contents: $contents}' >>"${additions}"
  fi
done <<<"${added}"
while IFS= read -r path; do
  if [[ -n "${path}" ]]; then
    jq -n --arg path "${path}" '{path: $path}' >>"${deletions}"
  fi
done <<<"${deleted}"

# build_payload <expected head oid>
build_payload() {
  jq -n \
    --arg repo "${GITHUB_REPOSITORY}" \
    --arg branch "${BRANCH}" \
    --arg oid "$1" \
    --arg headline "${headline}" \
    --arg body "${body}" \
    --slurpfile additions "${additions}" \
    --slurpfile deletions "${deletions}" \
    '{
      query: "mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid url } } }",
      variables: {
        input: {
          branch: {repositoryNameWithOwner: $repo, branchName: $branch},
          expectedHeadOid: $oid,
          message: {headline: $headline, body: $body},
          fileChanges: {additions: $additions, deletions: $deletions}
        }
      }
    }' >"${payload}"
}

# Other autofix jobs (for other paths, or a matrix over modules) can push to the
# branch between the fixers' checkout and this commit. The commit holds whole
# files, so it's still correct on top of theirs as long as none of the same
# files changed. Any other push means this run is stale: its fixes were made
# from old sources, and checks will run again on the new commit anyway.
expected="${HEAD_SHA}"
commit_url=""
for attempt in 1 2 3 4 5; do
  remote="$(gh api "repos/${GITHUB_REPOSITORY}/branches/${BRANCH}" --jq .commit.sha)"
  if [[ "${remote}" != "${expected}" ]]; then
    compare="$(gh api "repos/${GITHUB_REPOSITORY}/compare/${HEAD_SHA}...${remote}")"
    if [[ "$(jq -r .status <<<"${compare}")" != "ahead" ]]; then
      fail "${BRANCH} was rewritten since checkout. Checks will run again on the new commit."
    fi
    if jq -e --arg trailer "${trailer}" \
      'any(.commits[]; .commit.message | split("\n") | index($trailer) | not)' <<<"${compare}" >/dev/null; then
      fail "${BRANCH} was pushed to since checkout, so these fixes are stale. Checks will run again on the new commit."
    fi
    overlap="$(jq -r '.files[].filename' <<<"${compare}" | grep -Fxf <(echo "${changed_files}") || true)"
    if [[ -n "${overlap}" ]]; then
      fail "Another autofix job changed the same files since checkout (${overlap//$'\n'/, }). Checks will run again on the new commit."
    fi
    echo "Another autofix job pushed ${remote} without touching the same files, committing on top of it."
    expected="${remote}"
  fi

  build_payload "${expected}"
  if commit_url="$(gh api graphql --input "${payload}" --jq '.data.createCommitOnBranch.commit.url')"; then
    break
  fi
  commit_url=""
  sleep $((attempt * 2))
done

if [[ -z "${commit_url}" ]]; then
  fail "Failed to push the autofix commit to ${BRANCH}."
fi

echo "committed=true" | tee -a "$GITHUB_OUTPUT"
echo "commit-sha=${commit_url##*/}" | tee -a "$GITHUB_OUTPUT"
echo "Pushed autofix commit to ${BRANCH}: ${commit_url}" | tee -a "$GITHUB_STEP_SUMMARY"
