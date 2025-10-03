#!/bin/bash

# Script to parse Dockerfile for private ECR base images and extract registry IDs
# This script identifies ECR registries used in FROM statements and outputs them
# for automatic ECR authentication.

set -euo pipefail

echo "Parsing Dockerfile for private ECR base images..."

# Construct full dockerfile path
if [[ "${CONTEXT_PATH:-}" ]]; then
  dockerfile_full_path="${CONTEXT_PATH}/${DOCKERFILE_PATH}"
else
  dockerfile_full_path="${DOCKERFILE_PATH}"
fi

if [[ ! -f "${dockerfile_full_path}" ]]; then
  echo "::warning::Dockerfile not found at: ${dockerfile_full_path}"
  echo "ecr-registries=" | tee -a "$GITHUB_OUTPUT"
  echo "needs-ecr-login=false" | tee -a "$GITHUB_OUTPUT"
  exit 0
fi

echo "Analyzing Dockerfile: ${dockerfile_full_path}"

# Extract FROM statements and look for private ECR registry patterns
# Private ECR pattern: <account-id>.dkr.ecr.<region>.amazonaws.com
# This excludes public ECR which uses: public.ecr.aws
# Note: FROM statements are case-insensitive (FROM, from, From, etc.)
echo "Looking for FROM statements..."
from_statements=$(grep -i '^FROM' "${dockerfile_full_path}" || true)
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
  sed 's/,$//')

if [[ -n "${ecr_registries}" ]]; then
  echo "Found private ECR registries in Dockerfile: ${ecr_registries}"
  echo "ecr-registries=${ecr_registries}" | tee -a "$GITHUB_OUTPUT"
  echo "needs-ecr-login=true" | tee -a "$GITHUB_OUTPUT"

  # Check if we have the necessary AWS credentials
  if [[ -z "${AWS_ROLE_ARN:-}" ]]; then
    echo "::warning::Private ECR registries found in Dockerfile but aws-role-arn not provided. Skipping automatic ECR login."
    echo "needs-ecr-login=false" | tee -a "$GITHUB_OUTPUT"
  fi
else
  echo "No private ECR registries found in Dockerfile"
  echo "ecr-registries=" | tee -a "$GITHUB_OUTPUT"
  echo "needs-ecr-login=false" | tee -a "$GITHUB_OUTPUT"
fi