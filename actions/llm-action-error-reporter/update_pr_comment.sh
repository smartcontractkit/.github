#!/usr/bin/env bash
set -euo pipefail

# Required environment variables
# - WORKFLOW_ID
# - PR_NUMBER
# - PR_MESSAGE
# - OPENAI_MODEL
# - SKIP_ON_SUCCESS

# Fetch the comments on the pull request and filter for comments by github.actor
author_comments=$(gh pr view "$PR_NUMBER" --json comments --jq '.comments | map(select(.author.login == "github-actions" and (.body | contains("## AER Report:")))) | length')

# Get the latest comment body
latest_comment_body=$(gh pr view "$PR_NUMBER" --json comments --jq '.comments
| map(select(.author.login == "github-actions" and (.body | contains("## AER Report:"))))
| sort_by(.createdAt) | reverse | .[0].body')

# Check if comment exists and contains <$WORKFLOW_ID>...</$WORKFLOW_ID>
if [[ "$author_comments" -gt 0 && "$latest_comment_body" == *"<$WORKFLOW_ID>"* && "$latest_comment_body" == *"</$WORKFLOW_ID>"* ]]; then
  # Create a temporary sed script file
  sed_script=$(mktemp)

  # Escape backslashes and ampersands, but NOT forward slashes within HTML tags
  # The goal is to only escape backslashes and ampersands
  PR_MESSAGE=$(printf '%s' "$PR_MESSAGE" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g')
  # Replace newlines with escaped newlines for sed
  PR_MESSAGE=$(echo "$PR_MESSAGE" | sed 's/$/\\/' | sed '$s/\\$//')

  # Write the sed replacement command to the script
  echo "/<$WORKFLOW_ID>/,/<\\/${WORKFLOW_ID}>/c\\" > "$sed_script"
  echo "${PR_MESSAGE}" >> "$sed_script"

  # Perform the replacement using sed with the temporary script
  PR_MESSAGE=$(echo "$latest_comment_body" | sed -f "$sed_script")

  # Remove the temporary sed script
  rm "$sed_script"

  gh pr comment $PR_NUMBER -b "$PR_MESSAGE" --edit-last
else
  if [ "$author_comments" -gt 0 ]; then
    PR_MESSAGE="${latest_comment_body}
    
    ${PR_MESSAGE}"

    gh pr comment $PR_NUMBER -b "$PR_MESSAGE" --edit-last
  else
    # if no prior error(s) then don't clutter the PR with success message
    if [ "${SKIP_ON_SUCCESS:-false}" == "false" ] && [[ "{{ inputs.parent-workflow-conclusion }}" != "failure" ]]; then
      gh pr comment $PR_NUMBER -b "$PR_MESSAGE"
    else
      gh pr comment $PR_NUMBER -b "**Below is an analysis created by an LLM ($OPENAI_MODEL). Be mindful of hallucinations and verify accuracy.**
      
      $PR_MESSAGE"
    fi
  fi
fi
