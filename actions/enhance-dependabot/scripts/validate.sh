#!/usr/bin/env bash
# Guard for pull_request_target based triggers of enhance-dependabot.
#
# Fails unless the workflow was triggered by Dependabot itself, the PR head is
# an in-repository 'dependabot/*' branch, and that branch's head SHA is checked
# out as HEAD (pushing a merge/base ref would corrupt the Dependabot branch).
# The actor check enforces the documented consumer contract (gate the workflow
# on `github.actor == 'dependabot[bot]'`) even if a caller forgets it.
#
# Environment (all required):
#   PR_ACTOR          the actor that triggered the workflow (github.actor)
#   PR_HEAD_REF       the PR head branch name
#   PR_HEAD_REPO      the PR head repository, 'owner/repo'
#   PR_HEAD_SHA       the PR head commit SHA
#   GITHUB_REPOSITORY the repository the workflow runs in, 'owner/repo'

set -euo pipefail

fail() {
  echo "::error::$1" >&2
  exit 1
}

[[ -n "${PR_ACTOR:-}" ]] || fail "PR_ACTOR is not set."
if [[ "$PR_ACTOR" != "dependabot[bot]" ]]; then
  fail "Refusing to run: workflow actor '$PR_ACTOR' is not 'dependabot[bot]'."
fi
if [[ "${PR_HEAD_REPO:-}" != "$GITHUB_REPOSITORY" ]]; then
  fail "Refusing to run: PR head repository '${PR_HEAD_REPO:-}' is not '$GITHUB_REPOSITORY'."
fi
if [[ "${PR_HEAD_REF:-}" != dependabot/* ]]; then
  fail "Refusing to run: PR head branch '${PR_HEAD_REF:-}' is not a 'dependabot/*' branch."
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "No git checkout found. Check out the PR head (github.event.pull_request.head.sha) before running this action."
fi
head="$(git rev-parse HEAD)"
if [[ "$head" != "${PR_HEAD_SHA:-}" ]]; then
  fail "HEAD ($head) is not the PR head SHA (${PR_HEAD_SHA:-}). Check out 'github.event.pull_request.head.sha' with 'persist-credentials: true' before running this action; otherwise the push would carry a merge commit onto the Dependabot branch."
fi

echo "Validated: dependabot PR head '${PR_HEAD_REF}' (${PR_HEAD_SHA:0:12}) checked out as HEAD."
