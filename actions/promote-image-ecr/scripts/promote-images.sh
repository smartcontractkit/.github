#!/usr/bin/env bash

set -euo pipefail

# Create results directory and file
mkdir -p /tmp/promotion-results
RESULTS_FILE="/tmp/promotion-results/promotion-summary.md"
RESULTS_JSON="/tmp/promotion-results/promotion-results.json"

echo "# Image Promotion Results" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Date:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> "$RESULTS_FILE"
echo "**Copy Tool:** cosign" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

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
  echo "### $emoji ${repo}" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  echo "- **Source:** \`${repo}:${src_tag}\`" >> "$RESULTS_FILE"
  echo "- **Destination:** \`${dst_repo}:${dst_tag}\`" >> "$RESULTS_FILE"
  if [[ -n "$src_region" ]]; then
    echo "- **Source Region:** \`${src_region}\`" >> "$RESULTS_FILE"
  fi
  if [[ -n "$dst_region" ]]; then
    echo "- **Destination Region:** \`${dst_region}\`" >> "$RESULTS_FILE"
  fi
  if [[ "$status" == "success" ]]; then
    echo "- **Duration:** ${duration}s" >> "$RESULTS_FILE"
  fi
  echo "- **Status:** ${status^}" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
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
  echo "" >> "$RESULTS_FILE"
  echo "## Promoted Images" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  IMAGE_COUNT=0
  echo "$IMAGES_JSON" | jq -c '.[]' | while read -r image; do
    SRC_REPO=$(echo "$image" | jq -r '.source_repository')
    DST_REPO=$(echo "$image" | jq -r '.destination_repository')
    SRC_TAG=$(echo "$image" | jq -r '.source_tag')
    DST_TAG=$(echo "$image" | jq -r '.destination_tag')

    SRC="docker://${SOURCE_REGISTRY}/${SRC_REPO}:${SRC_TAG}"
    DST="docker://${DESTINATION_REGISTRY}/${DST_REPO}:${DST_TAG}"

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
  done
  echo "----------------------------------------"
  echo "All ${IMAGE_COUNT} images copied successfully!"

  # Add summary at the top
  sed -i "3i\\** Total Images Promoted:** ${IMAGE_COUNT}" "$RESULTS_FILE"
  sed -i "4i\\" "$RESULTS_FILE"
else
  # Process single image
  SRC="docker://${SOURCE_REGISTRY}/${SOURCE_REPOSITORY}:${SOURCE_TAG}"
  DST="docker://${DESTINATION_REGISTRY}/${DESTINATION_REPOSITORY}:${DESTINATION_TAG}"

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
