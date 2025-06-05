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

# Get branches containing the tag, with filtering for CI environments
# Filter out: detached HEAD states, current HEAD pointer, empty lines, and whitespace-only lines
SOURCE_BRANCHES=$(git branch -a --contains "${TAG_SHA}" | \
    grep -v '(detached from' | \
    grep -v '(HEAD' | \
    grep -v '^[[:space:]]*$' | \
    sed 's/^\* //' | \
    sed 's/^[[:space:]]*//' | \
    awk 'NF {print $1}')

echo "::debug::SOURCE_BRANCHES: ${SOURCE_BRANCHES}"

# Ensure we found at least one branch
if [[ -z "${SOURCE_BRANCHES}" ]]; then
    echo "::error::No valid branches found containing tag '${TAG}'. This may indicate a git repository issue."
    exit 1
fi

MATCH_FOUND=0
for branch in $SOURCE_BRANCHES; do
  # Skip empty or invalid branch names
  if [[ -z "${branch}" || "${branch}" == "(HEAD" || "${branch}" =~ ^\(.*\)$ ]]; then
    echo "::debug::Skipping invalid branch name: '${branch}'"
    continue
  fi

  echo "::debug::Processing branch: '${branch}'"

  # Strip 'remotes/origin/' prefix if present
  clean_branch="${branch#remotes/origin/}"
  echo "::debug::Clean branch name: '${clean_branch}'"

  echo "::debug::Checking if branch '${clean_branch}' matches the pattern '${BRANCH_REGEX}'..."
  if [[ "${clean_branch}" =~ ${BRANCH_REGEX} ]]; then
    echo "::debug::✓ Branch '${clean_branch}' matches pattern '${BRANCH_REGEX}'"
    MATCH_FOUND=1
    break
  else
    echo "::debug::✗ Branch '${clean_branch}' does not match pattern '${BRANCH_REGEX}'"
  fi
done

if [[ "${MATCH_FOUND}" -eq 0 ]]; then
  echo "::error::The tag '${TAG}' was not created from a branch that matches the pattern '${BRANCH_REGEX}'."
  exit 1
fi

echo "The tag '${TAG}' was created from a branch that matches the pattern '${BRANCH_REGEX}'."
