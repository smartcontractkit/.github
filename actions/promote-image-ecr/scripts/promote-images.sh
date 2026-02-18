#!/bin/bash
set -euo pipefail

# Create results directory and file
mkdir -p /tmp/promotion-results
RESULTS_FILE="/tmp/promotion-results/promotion-summary.md"
RESULTS_JSON="/tmp/promotion-results/promotion-results.json"

echo "# Image Promotion Results" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "**Date:** $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# Initialize JSON results
echo '{"promotions": []}' > "$RESULTS_JSON"

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

    echo "----------------------------------------"
    echo "Copying:"
    echo "  FROM: ${SRC}"
    echo "    TO: ${DST}"
    
    START_TIME=$(date +%s)
    if skopeo copy \
      $SKOPEO_ARGS \
      --src-creds "AWS:${SRC_PASS}" \
      --dest-creds "AWS:${DST_PASS}" \
      "${SRC}" \
      "${DST}"; then
      END_TIME=$(date +%s)
      DURATION=$((END_TIME - START_TIME))
      
      echo "✓ Successfully copied ${SRC_REPO}:${SRC_TAG} (took ${DURATION}s)"
      
      # Append to markdown
      echo "### ✅ ${SRC_REPO}" >> "$RESULTS_FILE"
      echo "" >> "$RESULTS_FILE"
      echo "- **Source:** \`${SRC_REPO}:${SRC_TAG}\`" >> "$RESULTS_FILE"
      echo "- **Destination:** \`${DST_REPO}:${DST_TAG}\`" >> "$RESULTS_FILE"
      echo "- **Source Region:** \`${SOURCE_AWS_REGION}\`" >> "$RESULTS_FILE"
      echo "- **Destination Region:** \`${DESTINATION_AWS_REGION}\`" >> "$RESULTS_FILE"
      echo "- **Duration:** ${DURATION}s" >> "$RESULTS_FILE"
      echo "- **Status:** Success" >> "$RESULTS_FILE"
      echo "" >> "$RESULTS_FILE"
      
      # Append to JSON
      jq --arg src_repo "$SRC_REPO" \
         --arg src_tag "$SRC_TAG" \
         --arg dst_repo "$DST_REPO" \
         --arg dst_tag "$DST_TAG" \
         --arg duration "$DURATION" \
         --arg status "success" \
         '.promotions += [{
           "source_repository": $src_repo,
           "source_tag": $src_tag,
           "destination_repository": $dst_repo,
           "destination_tag": $dst_tag,
           "duration_seconds": $duration,
           "status": $status
         }]' "$RESULTS_JSON" > "${RESULTS_JSON}.tmp" && mv "${RESULTS_JSON}.tmp" "$RESULTS_JSON"
      
      IMAGE_COUNT=$((IMAGE_COUNT + 1))
    else
      echo "✗ Failed to copy ${SRC_REPO}:${SRC_TAG}"
      
      # Append failure to markdown
      echo "### ❌ ${SRC_REPO}" >> "$RESULTS_FILE"
      echo "" >> "$RESULTS_FILE"
      echo "- **Source:** \`${SRC_REPO}:${SRC_TAG}\`" >> "$RESULTS_FILE"
      echo "- **Destination:** \`${DST_REPO}:${DST_TAG}\`" >> "$RESULTS_FILE"
      echo "- **Status:** Failed" >> "$RESULTS_FILE"
      echo "" >> "$RESULTS_FILE"
      
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

  echo "Copying:"
  echo "  FROM: ${SRC}"
  echo "    TO: ${DST}"

  echo "## Promoted Image" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"
  
  START_TIME=$(date +%s)
  # Notes:
  # - username for ECR basic auth is always "AWS"
  # - add "--all" if you want to copy multi-arch manifests too
  if skopeo copy \
    $SKOPEO_ARGS \
    --src-creds "AWS:${SRC_PASS}" \
    --dest-creds "AWS:${DST_PASS}" \
    "${SRC}" \
    "${DST}"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo "✓ Successfully copied ${SOURCE_REPOSITORY}:${SOURCE_TAG} (took ${DURATION}s)"
    
    # Write to markdown
    echo "### ✅ ${SOURCE_REPOSITORY}" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "- **Source:** \`${SOURCE_REPOSITORY}:${SOURCE_TAG}\`" >> "$RESULTS_FILE"
    echo "- **Destination:** \`${DESTINATION_REPOSITORY}:${DESTINATION_TAG}\`" >> "$RESULTS_FILE"
    echo "- **Source Region:** \`${SOURCE_AWS_REGION}\`" >> "$RESULTS_FILE"
    echo "- **Destination Region:** \`${DESTINATION_AWS_REGION}\`" >> "$RESULTS_FILE"
    echo "- **Duration:** ${DURATION}s" >> "$RESULTS_FILE"
    echo "- **Status:** Success" >> "$RESULTS_FILE"
    
    # Write to JSON
    jq --arg src_repo "$SOURCE_REPOSITORY" \
       --arg src_tag "$SOURCE_TAG" \
       --arg dst_repo "$DESTINATION_REPOSITORY" \
       --arg dst_tag "$DESTINATION_TAG" \
       --arg duration "$DURATION" \
       --arg status "success" \
       '.promotions += [{
         "source_repository": $src_repo,
         "source_tag": $src_tag,
         "destination_repository": $dst_repo,
         "destination_tag": $dst_tag,
         "duration_seconds": $duration,
         "status": $status
       }]' "$RESULTS_JSON" > "${RESULTS_JSON}.tmp" && mv "${RESULTS_JSON}.tmp" "$RESULTS_JSON"
  else
    echo "✗ Failed to copy ${SOURCE_REPOSITORY}:${SOURCE_TAG}"
    
    echo "### ❌ ${SOURCE_REPOSITORY}" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "- **Source:** \`${SOURCE_REPOSITORY}:${SOURCE_TAG}\`" >> "$RESULTS_FILE"
    echo "- **Destination:** \`${DESTINATION_REPOSITORY}:${DESTINATION_TAG}\`" >> "$RESULTS_FILE"
    echo "- **Status:** Failed" >> "$RESULTS_FILE"
    
    exit 1
  fi
fi
