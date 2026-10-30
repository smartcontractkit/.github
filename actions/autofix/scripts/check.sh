#!/usr/bin/env bash

# Decides what happens to the changes the fixers made to files in PATHS. When
# they can be committed, copies them to OUT_DIR for the commit action, which
# pushes them from a job that runs nothing the pull request controls. When they
# can't, fails.
#
# OUT_DIR holds the changed files under files/, and the deleted ones listed in
# deleted, one per line.

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"

COMMIT="${COMMIT:-true}"
BRANCH="${BRANCH:-}"
HEAD_SHA="${HEAD_SHA:-}"
PR_HEAD_REPO="${PR_HEAD_REPO:-}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-}"
OUT_DIR="${OUT_DIR:?}"

# Marks autofix commits, see commit.sh.
trailer="Autofix: true"

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
  echo "commit=false" | tee -a "$GITHUB_OUTPUT"
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

changed_files="$(git -c core.quotePath=false diff --cached --no-renames --name-only)"

reason=""
if [[ "${COMMIT}" != "true" ]]; then
  reason="committing is disabled"
elif [[ -n "${PR_HEAD_REPO}" && "${PR_HEAD_REPO}" != "${GITHUB_REPOSITORY}" ]]; then
  reason="the pull request is from a fork"
elif [[ "$(git rev-parse HEAD)" != "${HEAD_SHA}" ]]; then
  reason="the checkout is not ${HEAD_SHA}. Check out with 'ref: \${{ github.event.pull_request.head.sha || github.sha }}'"
elif [[ -z "${BRANCH}" ]]; then
  reason="no branch to commit to"
elif [[ "${BRANCH}" == "${DEFAULT_BRANCH}" || "${BRANCH}" == gh-readonly-queue/* ]]; then
  reason="'${BRANCH}' is the default branch or a merge queue branch"
elif grep -q '^\.github/' <<<"${changed_files}"; then
  # A commit there could change the workflows that run with this
  # repository's secrets.
  reason="autofix doesn't commit changes under .github"
elif git log -1 --format=%B | grep -qxF "${trailer}"; then
  # Guards against a commit loop when the commands are not idempotent. Another
  # job's autofix commit (e.g. for another directory) touches other files.
  overlap="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${HEAD_SHA}" --jq '.files[].filename' |
    grep -Fxf <(echo "${changed_files}") || true)"
  if [[ -n "${overlap}" ]]; then
    reason="HEAD is an autofix commit that already changed ${overlap//$'\n'/, }, so the commands do not converge"
  fi
fi

if [[ -z "${reason}" ]]; then
  while IFS= read -r -d '' status && IFS= read -r -d '' path; do
    if [[ "${path}" == *$'\n'* ]]; then
      reason="a changed path has a newline in it"
      break
    fi

    if [[ "${status}" != "D" && ( -L "${path}" || ! -f "${path}" ) ]]; then
      reason="${path} isn't a regular file"
      break
    fi
  done < <(git diff --cached --no-renames --name-status -z)
fi

if [[ -n "${reason}" ]]; then
  echo "commit=false" | tee -a "$GITHUB_OUTPUT"
  echo "::error::Autofix produced changes but can't commit them: ${reason}. Run the same commands locally and commit the result."
  exit 1
fi

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}/files"
: >"${OUT_DIR}/deleted"
while IFS= read -r -d '' status && IFS= read -r -d '' path; do
  if [[ "${status}" == "D" ]]; then
    printf '%s\n' "${path}" >>"${OUT_DIR}/deleted"
  else
    mkdir -p "${OUT_DIR}/files/$(dirname "${path}")"
    cp "${path}" "${OUT_DIR}/files/${path}"
  fi
done < <(git diff --cached --no-renames --name-status -z)

echo "commit=true" | tee -a "$GITHUB_OUTPUT"
