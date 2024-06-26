#!/usr/bin/env bash
set -euo pipefail

##
# Cleans up stale branches on a GitHub repository. Generally this should be
# invoked from a CI/CD pipelines via GitHub Actions.
#
# This does not delete the default branch or any protected branches.
# It also keeps branches that are associated with open pull requests and
# branches with commits newer than a certain threshold.
#
# Run this in the root of your git repository.
# This expects:
# - a full clone of the repository.
# - GH_TOKEN with these permission (can be set on the GHA workflow `permissions` field):
#   - contents: write
#   - pull-requests: write
# 
# Usage:
#   export GH_TOKEN=$(cat ~/.github_token) # or make it available from a GitHub Actions secret.
#   DRY_RUN=false BRANCHES_TO_KEEP=develop,main BRANCH_PREFIXES_TO_KEEP=release/,hotfix/ ./cleanup_branch.sh
##

# Define branches that should absolutely be kept (not deleted) here.
# Other rules are used to determine deletion but any branch or branch
# prefix added to these comma separated vars, will be preserved.
# XXX: If your branch name has a comma, this will not work.
BRANCHES_TO_KEEP="${BRANCHES_TO_KEEP:-}"
BRANCH_PREFIXES_TO_KEEP="${BRANCH_PREFIXES_TO_KEEP:-}"
# Days threshold. Branches older than this will be deleted. Default is 90 days.
DAYS_TO_KEEP="${DAYS_TO_KEEP:-90}"
# Dry run mode. Default is 'true'. Set to false to actually delete branches.
DRY_RUN="${DRY_RUN:-true}"
# Remote to use. Default is 'origin'.
GIT_REMOTE="${GIT_REMOTE:-origin}"

# Current date in epoch.
now=$(date +%s)
# STDOUT section delimiter.
section_delimiter="######################################"
# Define a global array to hold open PR branches.
declare -a OPEN_PR_BRANCHES=()
# Define a global array to hold protected branches.
declare -a PROTECTED_BRANCHES=()

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "::error::GH_TOKEN environment variable is required. Exiting..."
  exit 1
fi

# Fetch latest changes from origin.
git fetch --prune "${GIT_REMOTE}"

# Get the default base branch using the GitHub CLI.
default_branch=$(gh repo view \
  --json defaultBranchRef \
  --jq .defaultBranchRef.name)

echo "${section_delimiter}"
echo "Configuration Details:"
echo "${section_delimiter}"
echo "Default branch is: $default_branch"
echo "Branches newer than $DAYS_TO_KEEP days will be kept."
echo "BRANCHES_TO_KEEP: $BRANCHES_TO_KEEP"
echo "BRANCH_PREFIXES_TO_KEEP: $BRANCH_PREFIXES_TO_KEEP"
echo "DRY_RUN: $DRY_RUN"
echo "GIT_REMOTE: $GIT_REMOTE"
echo "${section_delimiter}"
echo

function get_protected_branches() {
  local response
  # Clear global array before filling it.
  PROTECTED_BRANCHES=()

  response=$(gh api repos/:owner/:repo/branches \
    --paginate -q '.[] | select(.protected == true) | .name')
  echo "::debug::Protected branches: $response"

  # Read the branch names into the array
  readarray -t PROTECTED_BRANCHES <<< "$response"
}

# Check if the branch should be kept.
# Returns: (zero for success, non-zero for failure)
#  0 - Keep the branch.
#  1 - Delete the branch.
function should_keep_branch() {
  local branch=$1
  local days_old=$2
  local branches_to_keep
  local prefixes_to_keep

  # Split comma-separated strings into arrays.
  IFS=',' read -r -a branches_to_keep <<< "$BRANCHES_TO_KEEP"
  IFS=',' read -r -a prefixes_to_keep <<< "$BRANCH_PREFIXES_TO_KEEP"

  if [[ "$branch" == "HEAD" ]]; then
    echo "$branch is HEAD, preserving."
    return 0
  fi

  # Loop through exact branches to keep.
  for kept_branch in "${branches_to_keep[@]}"; do
    if [[ "$branch" == "$kept_branch" ]]; then
      echo "$branch is in the list of branches to keep, preserving."
      return 0
    fi
  done

  # Loop through prefixes to keep.
  for prefix in "${prefixes_to_keep[@]}"; do
    if [[ "$branch" == "$prefix"* ]]; then
      echo "$branch starts with a prefix to keep, preserving."
      return 0
    fi
  done

  # Loop through each open PR branch to check if the branch is associated with an open PR.
  for open_branch in "${OPEN_PR_BRANCHES[@]}"; do
    if [[ "$open_branch" == "$branch" ]]; then
      echo "$branch is associated with an open PR, preserving."
      return 0
    fi
  done

  # Loop through each protected branch to check if the branch is protected.
  for protected_branch in "${PROTECTED_BRANCHES[@]}"; do
    if [[ "$protected_branch" == "$branch" ]]; then
      echo "$branch is a protected branch, preserving."
      return 0
    fi
  done

  # If the branch is the default branch, keep it.
  if [[ "$branch" == "$default_branch" ]]; then
    echo "$branch is the default branch, preserving."
    return 0
  fi

  # If the branch is newer than the threshold, keep it.
  if [[ $days_old -le $DAYS_TO_KEEP ]]; then
    echo "$branch is $days_old days old, preserving."
    return 0
  fi

  return 1  # Delete this branch.
}

# Get list of head/feature branches that are associated with open pull requests.
function get_open_pr_branches() {
  # Clear global array before filling it.
  OPEN_PR_BRANCHES=()
  local pr_branch_names
  # 1,000 PRs is the hard limit.
  pr_branch_names=$(gh pr list --state open \
    --json headRefName --jq '.[].headRefName' --limit 1000)
  readarray -t OPEN_PR_BRANCHES <<< "${pr_branch_names}"

  if [[ "${#OPEN_PR_BRANCHES[@]}" -eq 1000 ]]; then
    echo "::error::Too many open PR Branches. Limit of 1,000 open PRs reached: ${OPEN_PR_BRANCHES[*]}"
    exit 1
  fi
}

# Populate the PROTECTED_BRANCHES array.
get_protected_branches
# Populates the OPEN_PR_BRANCHES array.
get_open_pr_branches

# Loop through each remote branch.
git for-each-ref --format='%(refname) %(committerdate:raw)' "refs/remotes/${GIT_REMOTE}/" | while read -r line; do
  branch=$(echo "$line" | cut -d' ' -f1)
  branch="${branch#refs/remotes/"$GIT_REMOTE"/}"
  last_commit_date=$(echo "$line" | cut -d' ' -f2)
  last_commit_date=$(echo "$last_commit_date" | cut -d' ' -f1)
  # Calculate days since last commit.
  days_old=$(( (now - last_commit_date) / 86400 ))

  if should_keep_branch "$branch" "$days_old"; then
    echo "The branch $branch is preserved."
    continue
  else
    echo "The branch $branch is not preserved."
    if [[ $DRY_RUN == "false" ]]; then
      git push --delete "${GIT_REMOTE}" "${branch}"
    else
      echo "DRY RUN. Would have ran: git push --delete ${GIT_REMOTE} ${branch}"
    fi
  fi
done
