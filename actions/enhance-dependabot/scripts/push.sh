#!/usr/bin/env bash
# Pushes the enhancement commit (HEAD) to the Dependabot branch with PUSH_TOKEN.
#
# The enhance command ran in this checkout, so its git config and hooks are
# untrusted: drop local url/http/credential/include config (which could redirect
# or leak the token), ignore global/system config, and disable hooks.
#
# If the push is rejected because the branch moved off PR_HEAD_SHA (e.g. a
# Dependabot rebase), this run is superseded and exits 0 without pushing: the
# rebase triggers a new run that enhances the new head, and replaying output
# generated from the old head could land stale results.
#
# Environment:
#   PUSH_TOKEN        token used to push (required)
#   PR_HEAD_REF       the PR head branch name (required)
#   PR_HEAD_SHA       the PR head SHA the enhancement was built on (required)
#   GITHUB_REPOSITORY the repository the workflow runs in, 'owner/repo' (required)
#   GITHUB_OUTPUT     step outputs file; receives 'result=pushed|superseded'
#   PUSH_REMOTE_URL   push URL override (tests); defaults to the GitHub repository

set -euo pipefail

remote="${PUSH_REMOTE_URL:-https://x-access-token:${PUSH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git}"

{ git config --local --name-only --get-regexp '^(url|http|credential|include|includeif)\.' || true; } |
  sort -u | while read -r key; do git config --local --unset-all "$key"; done

git_safe() {
  GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
    git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"
}

if git_safe push "$remote" "HEAD:${PR_HEAD_REF}"; then
  echo "result=pushed" | tee -a "$GITHUB_OUTPUT"
  exit 0
fi

remote_head="$(git_safe ls-remote "$remote" "refs/heads/${PR_HEAD_REF}" | cut -f1)"
if [[ "$remote_head" != "$PR_HEAD_SHA" ]]; then
  echo "::notice::Branch '${PR_HEAD_REF}' moved off ${PR_HEAD_SHA:0:12} while this run was in progress; skipping the push, the newer run enhances the new head."
  echo "result=superseded" | tee -a "$GITHUB_OUTPUT"
  exit 0
fi

echo "::error::Failed to push the enhancement commit to '${PR_HEAD_REF}'." >&2
exit 1
