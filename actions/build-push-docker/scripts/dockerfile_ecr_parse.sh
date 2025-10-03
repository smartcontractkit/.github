#!/usr/bin/env bash

# Script to parse Dockerfile for private ECR base images and extract registry IDs
# This script identifies ECR registries used in FROM statements and outputs them
# for automatic ECR authentication.

set -euo pipefail

echo "Parsing Dockerfile for private ECR base images..."

# Helper function to output results (GitHub Actions format when in CI, regular output otherwise)
output_result() {
  local key="$1"
  local value="$2"
  
  if [[ "${CI:-}" == "true" && -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "${key}=${value}" | tee -a "$GITHUB_OUTPUT"
  else
    echo "OUTPUT: ${key}=${value}"
  fi
}

if [[ ! -f "${DOCKERFILE_PATH}" ]]; then
  echo "::warning::Dockerfile not found at: ${DOCKERFILE_PATH}"
  output_result "ecr-registries" ""
  output_result "needs-ecr-login" "false"
  exit 0
fi

echo "Analyzing Dockerfile: ${DOCKERFILE_PATH}"

# Extract FROM statements and look for private ECR registry patterns
# Private ECR pattern: <account-id>.dkr.ecr.<region>.amazonaws.com
# This excludes public ECR which uses: public.ecr.aws
# Note: FROM statements are case-insensitive (FROM, from, From, etc.)
echo "Looking for FROM statements..."
from_statements=$(grep -i '^FROM' "${DOCKERFILE_PATH}" || true)
if [[ -n "${from_statements}" ]]; then
  echo "Found FROM statements:"
  echo "${from_statements}"
else
  echo "No FROM statements found in Dockerfile"
fi

ecr_registries=$(echo "${from_statements}" | \
  grep -oE '[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com' | \
  grep -oE '^[0-9]{12}' | \
  sort -u | \
  tr '\n' ',' | \
  sed 's/,$//' || true)

if [[ -n "${ecr_registries}" ]]; then
  echo "Found private ECR registries in Dockerfile: ${ecr_registries}"
  output_result "ecr-registries" "${ecr_registries}"
  output_result "needs-ecr-login" "true"

  # Check if we have the necessary AWS credentials
  if [[ -z "${AWS_ROLE_ARN:-}" ]]; then
    echo "::warning::Private ECR registries found in Dockerfile but aws-role-arn not provided. Skipping automatic ECR login."
    output_result "needs-ecr-login" "false"
  fi
else
  echo "No private ECR registries found in Dockerfile"
  output_result "ecr-registries" ""
  output_result "needs-ecr-login" "false"
fi
