#!/usr/bin/env bash

# Commits any changes in the working tree to BRANCH, through the GitHub GraphQL
# API (createCommitOnBranch) so the commit is signed. Fails the step when there
# are changes that can't be committed, or when a commit was made and
# FAIL_ON_COMMIT is true.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMMIT="${COMMIT:-true}"
FAIL_ON_COMMIT="${FAIL_ON_COMMIT:-false}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-chore: autofix}"
BRANCH="${BRANCH:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"
PR_HEAD_REPO="${PR_HEAD_REPO:-}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-}"

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

cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

# Only files in PATHS are this job's to commit. Others belong to other jobs
# (or are build artifacts), so they're reported and left alone.
git add -A -- "${paths[@]}"
outside="$(git diff --name-only && git ls-files --others --exclude-standard)"
if [[ -n "${outside}" ]]; then
  echo "::warning::Ignoring changes outside ${paths[*]}:%0A${outside//$'\n'/%0A}"
fi

if git diff --cached --quiet; then
  echo "No changes."
  echo "changed=false" | tee -a "$GITHUB_OUTPUT"
  echo "committed=false" | tee -a "$GITHUB_OUTPUT"
  exit 0
fi
echo "changed=true" | tee -a "$GITHUB_OUTPUT"

echo "::group::Changes"
git diff --cached
echo "::endgroup::"
{
  echo "### Autofix changes"
  echo '```'
  git diff --cached --stat
  echo '```'
} >>"$GITHUB_STEP_SUMMARY"

head_sha="$(git rev-parse HEAD)"

reason=""
if [[ "${COMMIT}" != "true" ]]; then
  reason="committing is disabled"
elif [[ -n "${PR_HEAD_REPO}" && "${PR_HEAD_REPO}" != "${GITHUB_REPOSITORY}" ]]; then
  reason="the pull request is from a fork"
elif [[ -n "${PR_HEAD_SHA}" && "${PR_HEAD_SHA}" != "${head_sha}" ]]; then
  reason="the checkout is not the pull request head (${PR_HEAD_SHA}). Check out with 'ref: \${{ github.event.pull_request.head.sha }}'"
elif [[ -z "${BRANCH}" ]]; then
  reason="no branch to commit to"
elif [[ "${BRANCH}" == "${DEFAULT_BRANCH}" || "${BRANCH}" == gh-readonly-queue/* ]]; then
  reason="'${BRANCH}' is the default branch or a merge queue branch"
elif [[ -z "${GH_TOKEN:-}" ]]; then
  # Commits pushed with GITHUB_TOKEN don't trigger workflow runs, so checks
  # would never run on the autofix commit.
  reason="no github-token was given. Pass a GitHub App token, e.g. from setup-github-token"
elif git log -1 --format=%B | grep -qxF "${trailer}"; then
  # Guards against a commit loop when the commands are not idempotent. Another
  # job's autofix commit (e.g. for another directory) touches other files.
  overlap="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${head_sha}" --jq '.files[].filename' |
    grep -Fxf <(git diff --cached --no-renames --name-only) || true)"
  if [[ -n "${overlap}" ]]; then
    reason="HEAD is an autofix commit that already changed ${overlap//$'\n'/, }, so the commands do not converge"
  fi
fi

if [[ -n "${reason}" ]]; then
  echo "committed=false" | tee -a "$GITHUB_OUTPUT"
  echo "::error::Autofix produced changes but did not commit them: ${reason}. Run the same commands locally and commit the result."
  exit 1
fi

tmp="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
additions="$(mktemp "${tmp}/autofix-additions.XXXXXX")"
deletions="$(mktemp "${tmp}/autofix-deletions.XXXXXX")"
payload="$(mktemp "${tmp}/autofix-payload.XXXXXX")"
trap 'rm -f "${additions}" "${deletions}" "${payload}"' EXIT

while IFS= read -r -d '' status && IFS= read -r -d '' path; do
  if [[ "${status}" == "D" ]]; then
    jq -n --arg path "${path}" '{path: $path}' >>"${deletions}"
  else
    jq -n --arg path "${path}" --rawfile contents <(base64 <"${path}" | tr -d '\n') \
      '{path: $path, contents: $contents}' >>"${additions}"
  fi
done < <(git diff --cached --no-renames --name-status -z)

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
# branch between the checkout and this commit. The commit holds whole files, so
# it's still correct on top of theirs as long as none of the same files
# changed. Any other push means this run is stale: its fixes were made from old
# sources, and checks will run again on the new commit anyway.
changed_files="$(git diff --cached --no-renames --name-only)"
expected="${head_sha}"
commit_url=""
for attempt in 1 2 3 4 5; do
  remote="$(gh api "repos/${GITHUB_REPOSITORY}/branches/${BRANCH}" --jq .commit.sha)"
  if [[ "${remote}" != "${expected}" ]]; then
    compare="$(gh api "repos/${GITHUB_REPOSITORY}/compare/${head_sha}...${remote}")"
    if [[ "$(jq -r .status <<<"${compare}")" != "ahead" ]]; then
      echo "::error::${BRANCH} was rewritten since checkout. Checks will run again on the new commit."
      exit 1
    fi
    if jq -e --arg trailer "${trailer}" \
      'any(.commits[]; .commit.message | split("\n") | index($trailer) | not)' <<<"${compare}" >/dev/null; then
      echo "::error::${BRANCH} was pushed to since checkout, so these fixes are stale. Checks will run again on the new commit."
      exit 1
    fi
    overlap="$(jq -r '.files[].filename' <<<"${compare}" | grep -Fxf <(echo "${changed_files}") || true)"
    if [[ -n "${overlap}" ]]; then
      echo "::error::Another autofix job changed the same files since checkout (${overlap//$'\n'/, }). Checks will run again on the new commit."
      exit 1
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
  echo "::error::Failed to push the autofix commit to ${BRANCH}."
  exit 1
fi
commit_sha="${commit_url##*/}"

echo "committed=true" | tee -a "$GITHUB_OUTPUT"
echo "commit-sha=${commit_sha}" | tee -a "$GITHUB_OUTPUT"
echo "Pushed autofix commit to ${BRANCH}: ${commit_url}" | tee -a "$GITHUB_STEP_SUMMARY"

if [[ "${FAIL_ON_COMMIT}" == "true" ]]; then
  echo "::error::Pushed autofix commit ${commit_url}. Checks will run again on the new commit."
  exit 1
fi
