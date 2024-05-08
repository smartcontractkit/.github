#!/usr/bin/env bash
set -euo pipefail

##
# Cleans up stale branches on a GitHub repository. Generally this should be
# invoked from a CI/CD pipelines via GitHub Actions.
#
# This does not delete the default branch.
#
# Run this in the root of your git repository.
# This expects:
# - a full clone of the repository.
# - GH_TOKEN with permission to read/write to the repository.
# 
# Usage:
#   export GH_TOKEN=$(cat ~/.github_token) # *
#   DRY_RUN=false BRANCHES_TO_KEEP=develop,main BRANCH_PREFIXES_TO_KEEP=release/,hotfix/ ./cleanup_branch.sh
#
# * GitHub Actions prevents the default secrets.GITHUB_TOKEN from being used to delete branches,
#   even if with contents: write access. You must use a personal access token, fine-grained personal
#   access token, or a GitHub App installation token with the necessary permissions. Set this token
#   as the GH_TOKEN env var.
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

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "::error::GH_TOKEN environment variable is required. Exiting..."
  exit 1
fi

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  GITHUB_REPOSITORY=$(gh repo view --json 'nameWithOwner' --jq '.nameWithOwner')
fi

if [[ -z "${GITHUB_REPOSITORY_OWNER:-}" ]]; then
  GITHUB_REPOSITORY_OWNER=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1)
fi

GITHUB_REPOSITORY_NAME=$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)

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
# XXX: Would have preferred to use this:
#   gh pr list --state open --json headRefName --jq '.[].headRefName'
# But it had a hard maximum of PR's and does not currently support pagination.
function fetch_open_pr_branches() {
  # Clear global array before filling it.
  OPEN_PR_BRANCHES=()
  # Initialize cursor for pagination.
  end_cursor=""

  # Loop to fetch all pages of pull requests.
  while :; do
    # Fetch current batch of PRs and update cursor.
    response=$(gh api graphql -f query="
      query(\$endCursor: String) {
          repository(owner: \"$GITHUB_REPOSITORY_OWNER\", name:\"$GITHUB_REPOSITORY_NAME\") {
              pullRequests(states: OPEN, first: 100, after: \$endCursor) {
                  nodes {
                      headRefName
                  }
                  pageInfo {
                      hasNextPage
                      endCursor
                  }
              }
          }
      }" -f endCursor="$end_cursor" --paginate)
    
    # Check if there are PR branches to process.
    if ! echo "${response}" | jq -e '.data.repository.pullRequests.nodes | length > 0' >/dev/null; then
        echo "::debug::No PR branches found in the current fetch."
    else
        # Append PR head branch names to the OPEN_PR_BRANCHES array.
        while IFS= read -r line; do
            OPEN_PR_BRANCHES+=("$line")
        done < <(echo "$response" | jq -r '.data.repository.pullRequests.nodes[].headRefName')
    fi

    head_branch_names=$(echo "$response" | jq -r '.data.repository.pullRequests.nodes[].headRefName')
    readarray -t OPEN_PR_BRANCHES <<< "$head_branch_names"

    # Print the current batch of PR branches.
    if [ "${#OPEN_PR_BRANCHES[@]}" -gt 0 ]; then
      echo "::debug::Current batch of PR Branches: ${OPEN_PR_BRANCHES[*]}"
    else
      echo "::debug::No PR branches to display."
    fi

    # Check if there are more pages.
    has_next_page=$(echo "$response" | jq -r '.data.repository.pullRequests.pageInfo.hasNextPage')
    if [[ "${has_next_page}" == "false" ]]; then
      echo "::debug::No more pages to fetch on fetch_open_pr_branches()."
      break
    fi

    # Update cursor for next page
    end_cursor=$(echo "$response" | jq -r '.data.repository.pullRequests.pageInfo.endCursor')
  done
}

# Populates the OPEN_PR_BRANCHES array.
fetch_open_pr_branches

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
