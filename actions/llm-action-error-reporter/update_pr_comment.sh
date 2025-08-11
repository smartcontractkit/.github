#!/usr/bin/env bash
set -euo pipefail

# Required environment variables
# - WORKFLOW_ID
# - PR_NUMBER
# - PR_MESSAGE
# - OPENAI_MODEL
# - SKIP_ON_SUCCESS

# Fetch the comments on the pull request and filter for comments by github.actor
last_author_comment=$(gh pr view "$PR_NUMBER" --json comments --jq '(
    .comments 
    | map(select(.author.login == "github-actions" and (.body | contains("## AER Report:"))))
    | sort_by(.createdAt)
    | reverse
    | .[0]
  )')

# Get the latest comment body
last_comment_body=$(echo "$last_author_comment" | jq -r '.body // ""')
comment_id=$(echo "$last_author_comment" | jq -r '.url // ""' | perl -nle 'print $1 if /#issuecomment-(\d+)/')

echo "found existing comment: $comment_id"

# Check if comment exists and contains <$WORKFLOW_ID>...</$WORKFLOW_ID>
if [[ "$last_comment_body" == *"<$WORKFLOW_ID>"* && "$last_comment_body" == *"</$WORKFLOW_ID>"* ]]; then
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
  PR_MESSAGE=$(echo "$last_comment_body" | sed -f "$sed_script")

  # Remove the temporary sed script
  rm "$sed_script"
else
  if [[ "$last_comment_body" != "" ]]; then
    # AER comment already exists, edit the existing comment
    PR_MESSAGE="${last_comment_body}
  
    ${PR_MESSAGE}"
  else
    if [[ "{{ inputs.parent-workflow-conclusion }}" == "failure" ]]; then
      # AER comment does not exist, create a new comment
      PR_MESSAGE="**Below is an analysis created by an LLM ($OPENAI_MODEL). Be mindful of hallucinations and verify accuracy.**
      
      $PR_MESSAGE"
    fi
  fi
fi

echo "$PR_MESSAGE" > pr_message.md
echo "comment_id=$comment_id" >> "$GITHUB_OUTPUT"
