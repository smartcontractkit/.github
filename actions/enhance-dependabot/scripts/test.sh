#!/usr/bin/env bash
# Unit tests for scripts/validate.sh. Deterministic and isolated: every case
# runs against a throwaway git fixture in a temp directory. Run from anywhere:
#   bash actions/enhance-dependabot/scripts/test.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE="$SCRIPT_DIR/validate.sh"

PASS=0
FAIL=0
FIXTURE=""

# shellcheck disable=SC2329  # invoked via trap below
cleanup() {
  [[ -n "${FIXTURE:-}" ]] && rm -rf "$FIXTURE"
}
trap cleanup EXIT

# make_fixture: fresh git repo with one commit on branch 'dependabot/fixture',
# in repository 'owner/repo'. Sets FIXTURE and SHA globals.
make_fixture() {
  FIXTURE="$(mktemp -d)"
  git -C "$FIXTURE" init --quiet --initial-branch=main
  git -C "$FIXTURE" config user.name "test"
  git -C "$FIXTURE" config user.email "test@example.com"
  # Isolate from host gitconfig (e.g. commit.gpgsign with no secret key).
  git -C "$FIXTURE" config commit.gpgsign false
  touch "$FIXTURE/file"
  git -C "$FIXTURE" add file
  git -C "$FIXTURE" commit --quiet -m "init"
  git -C "$FIXTURE" checkout --quiet -b dependabot/fixture
  SHA="$(git -C "$FIXTURE" rev-parse HEAD)"
}

# expect_fail NAME EXPECTED_SUBSTRING WORKDIR -- ENV... : run validate.sh
# with ENV assignments and a non-git-optional working directory; assert it
# exits non-zero and its output mentions EXPECTED_SUBSTRING.
expect_fail() {
  local name="$1" expected="$2" workdir="$3"
  shift 3
  local output status
  output="$(cd "$workdir" && env "$@" bash "$VALIDATE" 2>&1)"
  status=$?
  if [[ $status -eq 0 ]]; then
    echo "FAIL: $name: expected non-zero exit, got 0"
    FAIL=$((FAIL + 1))
    return
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "FAIL: $name: expected output to mention '$expected', got:"
    echo "$output"
    FAIL=$((FAIL + 1))
    return
  fi
  echo "ok: $name"
  PASS=$((PASS + 1))
}

# expect_ok NAME WORKDIR -- ENV... : run validate.sh and assert exit 0.
expect_ok() {
  local name="$1" workdir="$2"
  shift 2
  local output status
  output="$(cd "$workdir" && env "$@" bash "$VALIDATE" 2>&1)"
  status=$?
  if [[ $status -ne 0 ]]; then
    echo "FAIL: $name: expected exit 0, got $status:"
    echo "$output"
    FAIL=$((FAIL + 1))
    return
  fi
  echo "ok: $name"
  PASS=$((PASS + 1))
}

make_fixture
no_git="$(mktemp -d)"

echo "== validate.sh tests =="

expect_fail "rejects non-dependabot actor" "workflow actor" "$FIXTURE" \
  PR_ACTOR="malicious-user" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

expect_fail "rejects fork PR" "PR head repository" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="attacker/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

expect_fail "rejects non-dependabot branch" "'dependabot/*' branch" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="feature/evil" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

expect_fail "rejects missing git checkout" "No git checkout found" "$no_git" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

expect_fail "rejects HEAD != PR head SHA" "is not the PR head SHA" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="0000000000000000000000000000000000000000" \
  GITHUB_REPOSITORY="owner/repo"

expect_ok "accepts valid dependabot PR head" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

rm -rf "$no_git"

echo
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed."
  exit 0
fi
echo "$FAIL of $((PASS + FAIL)) tests failed."
exit 1
