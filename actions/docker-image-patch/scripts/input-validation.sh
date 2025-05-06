#!/usr/bin/env bash
set -euo pipefail

echo "Checking if valid inputs are provided..."

# Check that at least one of COPY_PATHS or DOCKER_ENVS is set
if [[ -z "${COPY_PATHS:-}" && -z "${DOCKER_ENVS:-}" ]]; then
  echo "::error::At least one of COPY_PATHS or DOCKER_ENVS must be set."
  exit 1
fi

if [[ -z "${DOCKER_REGISTRY_URL_DST:-}" ]]; then
  echo "::error::DOCKER_REGISTRY_URL_DST is not set."
  exit 1
fi

if [[ -z "${DOCKER_REGISTRY_URL_SRC:-}" ]]; then
  echo "::error::DOCKER_REGISTRY_URL_SRC is not set."
  exit 1
fi

# Regex patterns for validation.
regex_ecr_private="^[0-9]{12}\.dkr\.ecr\.[a-z]{2}-[a-z]+-[0-9]\.amazonaws\.com$"
regex_ecr_public="^public\.ecr\.aws$"
regex_copy_path_pair='^[^:]+:[^:]+$'
regex_env_var='^[A-Za-z0-9_]+=.+$'

# Validate ECR registry URLs.
if [[ ! "$DOCKER_REGISTRY_URL_SRC" =~ $regex_ecr_private && ! "$DOCKER_REGISTRY_URL_SRC" =~ $regex_ecr_public ]]; then
  echo "::error::inputs.docker-registry-url-src must be a private or public ECR."
  exit 1
fi
if [[ ! "$DOCKER_REGISTRY_URL_DST" =~ $regex_ecr_private ]]; then
  echo "::error::inputs.docker-registry-url-dest must be a private ECR."
  exit 1
fi

# Validate source/destination paths if provided
if [[ -n "${COPY_PATHS:-}" ]]; then
  while IFS= read -r line; do
    # Strip leading/trailing space.
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    # Skip empty or comment lines.
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    # Check if the source path exists.
    src_path="${line%%:*}"
    if [[ ! -e "$src_path" ]]; then
      echo "::error::Source path '$src_path' does not exist on the host."
      exit 1
    fi

    if [[ ! "$line" =~ $regex_copy_path_pair ]]; then
      echo "::error::Invalid copy-path entry: '$line'"
      exit 1
    fi
  done <<<"${COPY_PATHS}"
fi

# Validate Docker environment variables if provided
if [[ -n "${DOCKER_ENVS:-}" ]]; then
  while IFS= read -r line; do
    # Strip leading/trailing space.
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    # Skip empty or comment lines.
    [[ -z "$line" || "$line" =~ ^# ]] && continue

    if [[ ! "$line" =~ $regex_env_var ]]; then
      echo "::error::Invalid environment variable format: '$line'. Must be in format KEY=VALUE."
      exit 1
    fi
  
    # Validate that the environment variable name is valid
    env_name="${line%%=*}"
    if [[ ! $env_name =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      echo "::error::Invalid environment variable name: '$env_name'. Names must start with a letter or underscore and contain only alphanumeric characters and underscores."
      exit 1
    fi
  done <<<"${DOCKER_ENVS:-}"
fi

echo "All inputs are valid!"
