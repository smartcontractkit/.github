#!/usr/bin/env bash
set -euo pipefail

##
# Checks if git branch(es) contain a git tag
##

if [[ -z "${TAG:-}" ]]; then
    echo "::error::TAG environment variable is required. Exiting..."
    exit 1
fi
if [[ -z "${BRANCH_REGEX:-}" ]]; then
    echo "::error::BRANCH_REGEX environment variable is required. Exiting..."
    exit 1
fi

# Get the sha of the tag's ancestor commit
TAG_SHA=$(git rev-parse "${TAG}^{commit}")
echo "::debug::TAG_SHA: ${TAG_SHA}"
SOURCE_BRANCHES=$(git branch -a --contains "${TAG_SHA}" | grep -v '(detached from' | sed 's/^\* //' | awk '{print $1}')
echo "::debug::SOURCE_BRANCHES: ${SOURCE_BRANCHES}"

MATCH_FOUND=0
for branch in $SOURCE_BRANCHES; do
  echo "::debug::Stripping 'remotes/origin/' from branch name '${branch}'..."
  branch="${branch#remotes/origin/}"
  echo "::debug::Checking if branch '${branch}' matches the pattern '${BRANCH_REGEX}'..."
  if [[ "$branch" =~ ${BRANCH_REGEX} ]]; then
    MATCH_FOUND=1
    break
  fi
done

if [[ "${MATCH_FOUND}" -eq 0 ]]; then
  echo "::error::The tag '${TAG}' was not created from a branch that matches the pattern '${BRANCH_REGEX}'."
  exit 1
fi

echo "The tag '${TAG}' was created from a branch that matches the pattern '${BRANCH_REGEX}'."
