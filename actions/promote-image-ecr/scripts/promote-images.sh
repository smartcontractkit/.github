#!/usr/bin/env bash

set -euo pipefail

# Create results directory and file
mkdir -p /tmp/promotion-results
RESULTS_FILE="/tmp/promotion-results/promotion-summary.md"
RESULTS_JSON="/tmp/promotion-results/promotion-results.json"

{
  echo "# Image Promotion Results"
  echo ""
  echo "**Date:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "**Copy Tool:** cosign"
  echo ""
} > "$RESULTS_FILE"

# Initialize JSON results
echo '{"promotions": []}' > "$RESULTS_JSON"

# Function to copy image using cosign only
copy_image() {
  local src="$1"
  local dst="$2"
  # cosign copy includes signatures and attestations by default
  cosign copy "${src}" "${dst}"
}

# Function to append promotion result to markdown
write_markdown_result() {
  local repo="$1"
  local src_tag="$2"
  local dst_repo="$3"
  local dst_tag="$4"
  local src_region="$5"
  local dst_region="$6"
  local duration="$7"
  local status="$8"
  local emoji=""
  # Use check mark for success and cross mark for failure
  if [[ "$status" == "success" ]]; then
    emoji="✅"
  else
    emoji="❌"
  fi
  {
    echo "### $emoji ${repo}"
    echo ""
    echo "- **Source:** \`${repo}:${src_tag}\`"
    echo "- **Destination:** \`${dst_repo}:${dst_tag}\`"
    if [[ -n "$src_region" ]]; then
      echo "- **Source Region:** \`${src_region}\`"
    fi
    if [[ -n "$dst_region" ]]; then
      echo "- **Destination Region:** \`${dst_region}\`"
    fi
    if [[ "$status" == "success" ]]; then
      echo "- **Duration:** ${duration}s"
    fi
    echo "- **Status:** ${status^}"
    echo ""
  } >> "$RESULTS_FILE"
}

# Function to append promotion result to JSON
write_promotion_json() {
  local src_repo="$1"
  local src_tag="$2"
  local dst_repo="$3"
  local dst_tag="$4"
  local duration="$5"
  local status="$6"
  # Append promotion result to JSON array
  jq --arg src_repo "$src_repo" \
     --arg src_tag "$src_tag" \
     --arg dst_repo "$dst_repo" \
     --arg dst_tag "$dst_tag" \
     --arg duration "$duration" \
     --arg status "$status" \
     '.promotions += [{
       "source_repository": $src_repo,
       "source_tag": $src_tag,
       "destination_repository": $dst_repo,
       "destination_tag": $dst_tag,
       "duration_seconds": $duration,
       "status": $status
     }]' "$RESULTS_JSON" > "${RESULTS_JSON}.tmp" && mv "${RESULTS_JSON}.tmp" "$RESULTS_JSON"
}


# Check if images matrix is provided
if [[ -n "$IMAGES_JSON" ]]; then
  # Process multiple images
  echo "Processing multiple images from matrix..."
  {
    echo ""
    echo "## Promoted Images"
    echo ""
  } >> "$RESULTS_FILE"

  if ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$IMAGES_JSON"; then
    echo "::error::images input must be a JSON array"
    exit 1
  fi

  # Read from a process substitution, not a pipe: a piped `while` runs in a
  # subshell, so IMAGE_COUNT below would be discarded and the failure `exit 1`
  # would leave the subshell rather than the script.
  IMAGE_COUNT=0
  while read -r image; do
    SRC_REPO=$(echo "$image" | jq -r '.source_repository')
    DST_REPO=$(echo "$image" | jq -r '.destination_repository')
    SRC_TAG=$(echo "$image" | jq -r '.source_tag')
    DST_TAG=$(echo "$image" | jq -r '.destination_tag')

    SRC="${SOURCE_REGISTRY}/${SRC_REPO}:${SRC_TAG}"
    DST="${DESTINATION_REGISTRY}/${DST_REPO}:${DST_TAG}"

    echo "-> Copying ${SRC} to ${DST}"

    START_TIME=$(date +%s)
    if copy_image "${SRC}" "${DST}"; then
      END_TIME=$(date +%s)
      DURATION=$((END_TIME - START_TIME))

      echo "✓ Successfully copied ${SRC} to ${DST} (took ${DURATION}s)"

      # Append to markdown
      write_markdown_result "$SRC_REPO" "$SRC_TAG" "$DST_REPO" "$DST_TAG" "$SOURCE_AWS_REGION" "$DESTINATION_AWS_REGION" "$DURATION" "success"
      # Append to JSON
      write_promotion_json "$SRC_REPO" "$SRC_TAG" "$DST_REPO" "$DST_TAG" "$DURATION" "success"

      IMAGE_COUNT=$((IMAGE_COUNT + 1))
    else
      echo "✗ Failed to copy ${SRC} to ${DST}"

      # Append failure to markdown
      write_markdown_result "$SRC_REPO" "$SRC_TAG" "$DST_REPO" "$DST_TAG" "$SOURCE_AWS_REGION" "$DESTINATION_AWS_REGION" "0" "failed"
      # Append failure to JSON
      write_promotion_json "$SRC_REPO" "$SRC_TAG" "$DST_REPO" "$DST_TAG" "0" "failed"

      exit 1
    fi
  done < <(jq -c '.[]' <<<"$IMAGES_JSON")
  echo "----------------------------------------"
  echo "All ${IMAGE_COUNT} images copied successfully!"

  # Add the total just under the title block. Done by rewriting the file rather
  # than with `sed -i "4i\\"`, which GNU sed rejects: `i` with nothing after it.
  {
    head -n 2 "$RESULTS_FILE"
    echo "**Total Images Promoted:** ${IMAGE_COUNT}"
    echo ""
    tail -n +3 "$RESULTS_FILE"
  } > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
else
  # Process single image
  SRC="${SOURCE_REGISTRY}/${SOURCE_REPOSITORY}:${SOURCE_TAG}"
  DST="${DESTINATION_REGISTRY}/${DESTINATION_REPOSITORY}:${DESTINATION_TAG}"

  echo "-> Copying ${SRC} to ${DST}"

  echo "## Promoted Image" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  START_TIME=$(date +%s)
  if copy_image "${SRC}" "${DST}"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo "✓ Successfully copied ${SRC} to ${DST} (took ${DURATION}s)"

    # Write to markdown
    write_markdown_result "$SOURCE_REPOSITORY" "$SOURCE_TAG" "$DESTINATION_REPOSITORY" "$DESTINATION_TAG" "$SOURCE_AWS_REGION" "$DESTINATION_AWS_REGION" "$DURATION" "success"
    # Write to JSON
    write_promotion_json "$SOURCE_REPOSITORY" "$SOURCE_TAG" "$DESTINATION_REPOSITORY" "$DESTINATION_TAG" "$DURATION" "success"
  else
    echo "✗ Failed to copy ${SRC} to ${DST}"
    # Write failure to markdown
    write_markdown_result "$SOURCE_REPOSITORY" "$SOURCE_TAG" "$DESTINATION_REPOSITORY" "$DESTINATION_TAG" "$SOURCE_AWS_REGION" "$DESTINATION_AWS_REGION" "0" "failed"
    # Write failure to JSON
    write_promotion_json "$SOURCE_REPOSITORY" "$SOURCE_TAG" "$DESTINATION_REPOSITORY" "$DESTINATION_TAG" "0" "failed"
  
    exit 1
  fi
fi
