#!/usr/bin/env bash
set -euo pipefail

###
# This script patches a Docker image by copying files from the host to the
# container as well as adding environment variables.
# It creates a new image with the patched changes.
###

# This is the full image name with tag of the destination image.
if [[ -z "${DOCKER_FULL_IMAGE_DST:-}" ]]; then
  echo "::error::DOCKER_FULL_IMAGE_DST is not set."
  exit 1
fi

# This is the full image name with tag of the source image.
if [[ -z "${DOCKER_FULL_IMAGE_SRC:-}" ]]; then
  echo "::error::DOCKER_FULL_IMAGE_SRC is not set."
  exit 1
fi

TEMP_DOCKER_CONTAINER_NAME="${TEMP_DOCKER_CONTAINER_NAME:-tmp-patch}"

echo "Creating container from source image..."
docker create --name "${TEMP_DOCKER_CONTAINER_NAME}" "${DOCKER_FULL_IMAGE_SRC}"

# Copy local paths from host to the container if COPY_PATHS is provided
if [[ -n "${COPY_PATHS:-}" ]]; then
  echo "Adding paths to patched Docker image..."
  while IFS= read -r line; do
    # Strip leading/trailing space.
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    
    # Skip empty or comment lines.
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    
    # Set the source and destination paths.
    src_path="${line%%:*}"
    dst_path="${line##*:}"

    echo "Copying from host: $src_path to container: $dst_path"
    docker cp "${src_path}" "${TEMP_DOCKER_CONTAINER_NAME}:${dst_path}"
  done <<<"$COPY_PATHS"
else
  echo "No paths to copy, skipping file copy step."
fi

# Add general args.
COMMIT_ARGS=(
  "--pause"
  "--change" "LABEL org.smartcontractkit.image.build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  "--change" "LABEL org.smartcontractkit.image.source=${DOCKER_FULL_IMAGE_SRC}"
)

# Add environment variables from DOCKER_ENVS if provided
if [[ -n "${DOCKER_ENVS:-}" ]]; then
  echo "Adding environment variables to the image..."
  while IFS= read -r line; do
    # Strip leading/trailing space
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    
    # Skip empty or comment lines
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    
    # Add each env var as a change directive
    echo "Adding environment variable: $line"
    COMMIT_ARGS+=("--change" "ENV $line")
  done <<<"$DOCKER_ENVS"
else
  echo "No environment variables to add, skipping env var step."
fi

# Add GitHub-specific labels only when running in GitHub Actions.
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "Adding GitHub-specific labels to the image..."
  COMMIT_ARGS+=("--change" "LABEL org.opencontainers.image.source=https://github.com/${GITHUB_REPOSITORY}")
  COMMIT_ARGS+=("--change" "LABEL org.opencontainers.image.revision=${GITHUB_SHA}")
  COMMIT_ARGS+=("--change" "LABEL org.opencontainers.image.ref.name=${GITHUB_REF:-unknown}")
  COMMIT_ARGS+=("--change" "LABEL org.smartcontractkit.image.build.url=https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}")
fi

# Execute Docker commit with all the arguments to create a new image with the changes.
echo "Committing changes to create new image..."
docker container commit "${COMMIT_ARGS[@]}" "${TEMP_DOCKER_CONTAINER_NAME}" "${DOCKER_FULL_IMAGE_DST}"
echo "New image created: ${DOCKER_FULL_IMAGE_DST}"

# Clean up.
echo "Removing temporary container..."
docker rm "${TEMP_DOCKER_CONTAINER_NAME}"
