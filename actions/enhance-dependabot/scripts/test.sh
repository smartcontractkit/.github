#!/usr/bin/env bash
# Unit tests for scripts/validate.sh and scripts/push.sh. Deterministic and
# isolated: every case runs against throwaway git fixtures in a temp directory.
# Run from anywhere:
#   bash actions/enhance-dependabot/scripts/test.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATE="$SCRIPT_DIR/validate.sh"
PUSH="$SCRIPT_DIR/push.sh"

PASS=0
FAIL=0
ROOT="$(mktemp -d "${TMPDIR:-/tmp}/enhance-dependabot-test.XXXXXX")" || exit 1
OUTPUT=""

# shellcheck disable=SC2329  # invoked via trap below
cleanup() {
  rm -rf "$ROOT"
}
trap cleanup EXIT

# init_repo DIR: git repo isolated from host gitconfig (e.g. commit.gpgsign
# with no secret key).
init_repo() {
  git -C "$1" init --quiet --initial-branch=main
  git -C "$1" config user.name "test"
  git -C "$1" config user.email "test@example.com"
  git -C "$1" config commit.gpgsign false
}

# make_fixture: fresh git repo with one commit on branch 'dependabot/fixture',
# in repository 'owner/repo'. Sets FIXTURE and SHA globals.
make_fixture() {
  FIXTURE="$(mktemp -d "$ROOT/fixture.XXXXXX")"
  init_repo "$FIXTURE"
  touch "$FIXTURE/file"
  git -C "$FIXTURE" add file
  git -C "$FIXTURE" commit --quiet -m "init"
  git -C "$FIXTURE" checkout --quiet -b dependabot/fixture
  SHA="$(git -C "$FIXTURE" rev-parse HEAD)"
}

# make_push_fixture: bare remote whose 'dependabot/fixture' branch is at
# BASE_SHA, and a clone whose HEAD is an enhancement commit on top of it.
# Sets PUSH_DIR, REMOTE_URL, CLONE, BASE_SHA and OUT (GITHUB_OUTPUT) globals.
make_push_fixture() {
  PUSH_DIR="$(mktemp -d "$ROOT/push.XXXXXX")"
  git init --quiet --bare "$PUSH_DIR/remote.git"
  REMOTE_URL="file://$PUSH_DIR/remote.git"
  CLONE="$PUSH_DIR/clone"
  mkdir "$CLONE"
  init_repo "$CLONE"
  echo "base" >"$CLONE/file"
  git -C "$CLONE" add file
  git -C "$CLONE" commit --quiet -m "base"
  BASE_SHA="$(git -C "$CLONE" rev-parse HEAD)"
  git -C "$CLONE" push --quiet "$REMOTE_URL" HEAD:refs/heads/dependabot/fixture
  echo "enhanced" >"$CLONE/file"
  git -C "$CLONE" commit --quiet -am "enhance"
  OUT="$PUSH_DIR/github-output"
  : >"$OUT"
}

# run_push: run push.sh in the push fixture clone. Sets OUTPUT and STATUS.
run_push() {
  OUTPUT="$(cd "$CLONE" && env PUSH_TOKEN="unused" \
    PR_HEAD_REF="dependabot/fixture" \
    PR_HEAD_SHA="$BASE_SHA" \
    GITHUB_REPOSITORY="owner/repo" \
    GITHUB_OUTPUT="$OUT" \
    PUSH_REMOTE_URL="$REMOTE_URL" \
    bash "$PUSH" 2>&1)"
  STATUS=$?
}

remote_head() {
  git -C "$PUSH_DIR/remote.git" rev-parse dependabot/fixture
}

# check NAME CMD... : assert CMD succeeds; print the last script output if not.
check() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok: $name"
    PASS=$((PASS + 1))
    return
  fi
  echo "FAIL: $name; script output:"
  echo "$OUTPUT"
  FAIL=$((FAIL + 1))
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
no_git="$(mktemp -d "$ROOT/no-git.XXXXXX")"

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

git -C "$FIXTURE" config "http.https://github.com/.extraheader" "AUTHORIZATION: basic dGVzdA=="
expect_fail "rejects persisted checkout credentials" "persist-credentials: false" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"
git -C "$FIXTURE" config --unset "http.https://github.com/.extraheader"

expect_ok "accepts valid dependabot PR head" "$FIXTURE" \
  PR_ACTOR="dependabot[bot]" \
  PR_HEAD_REF="dependabot/fixture" \
  PR_HEAD_REPO="owner/repo" \
  PR_HEAD_SHA="$SHA" \
  GITHUB_REPOSITORY="owner/repo"

echo
echo "== push.sh tests =="

make_push_fixture
run_push
check "pushes fast-forward: exits 0" test "$STATUS" -eq 0
check "pushes fast-forward: updates branch" \
  test "$(remote_head)" = "$(git -C "$CLONE" rev-parse HEAD)"
check "pushes fast-forward: reports pushed" grep -qx "result=pushed" "$OUT"

make_push_fixture
# Simulate a Dependabot rebase: the branch moves off BASE_SHA mid-run.
moved="$(git -C "$CLONE" commit-tree -p "$BASE_SHA" -m "rebased" "$BASE_SHA^{tree}")"
git -C "$CLONE" push --quiet --force "$REMOTE_URL" "$moved:refs/heads/dependabot/fixture"
run_push
check "superseded when branch moved: exits 0" test "$STATUS" -eq 0
check "superseded when branch moved: leaves branch" test "$(remote_head)" = "$moved"
check "superseded when branch moved: reports superseded" \
  grep -qx "result=superseded" "$OUT"

make_push_fixture
printf '#!/bin/sh\nexit 1\n' >"$PUSH_DIR/remote.git/hooks/pre-receive"
chmod +x "$PUSH_DIR/remote.git/hooks/pre-receive"
run_push
check "fails when rejected and branch not moved: exits non-zero" \
  test "$STATUS" -ne 0
check "fails when rejected and branch not moved: leaves branch" \
  test "$(remote_head)" = "$BASE_SHA"
check "fails when rejected and branch not moved: reports nothing" test ! -s "$OUT"

make_push_fixture
# Config and hooks an enhance command could plant to redirect or leak the token.
marker="$PUSH_DIR/hook-ran"
printf '#!/bin/sh\ntouch "%s"\n' "$marker" >"$CLONE/.git/hooks/pre-push"
chmod +x "$CLONE/.git/hooks/pre-push"
git -C "$CLONE" config "url.file://$PUSH_DIR/evil.git.insteadOf" "$REMOTE_URL"
run_push
check "ignores planted config and hooks: exits 0" test "$STATUS" -eq 0
check "ignores planted config and hooks: pushes to real remote" \
  test "$(remote_head)" = "$(git -C "$CLONE" rev-parse HEAD)"
check "ignores planted config and hooks: skips hooks" test ! -e "$marker"
check "ignores planted config and hooks: drops url config" \
  test -z "$(git -C "$CLONE" config --get-regexp '^url\.')"

echo
if [[ $FAIL -eq 0 ]]; then
  echo "All $PASS tests passed."
  exit 0
fi
echo "$FAIL of $((PASS + FAIL)) tests failed."
exit 1
