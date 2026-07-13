#!/usr/bin/env bash
# Verify a cosign signature, retrying to absorb Sigstore/Rekor propagation lag.
#
# The "no signatures found" error can occur transiently right after a successful
# sign while the signature propagates. Retrying here (rather than re-running the
# manifest create/sign job) avoids index digest drift — see RANE-4683.
#
# Inputs (environment):
#   IMAGE                       (required) image ref including digest
#   OIDC_IDENTITY_REGEXP        (required) expected Fulcio identity regexp
#   GITHUB_WORKFLOW_REPOSITORY  (required) expected workflow repo (owner/repo)
#   OIDC_ISSUER                 (optional) default: GitHub Actions OIDC issuer
#   MAX_RETRIES                 (optional) default: 5
#   RETRY_DELAY_SECONDS         (optional) default: 10
set -euo pipefail

: "${IMAGE:?IMAGE is required}"
: "${OIDC_IDENTITY_REGEXP:?OIDC_IDENTITY_REGEXP is required}"
: "${GITHUB_WORKFLOW_REPOSITORY:?GITHUB_WORKFLOW_REPOSITORY is required}"
OIDC_ISSUER="${OIDC_ISSUER:-https://token.actions.githubusercontent.com}"
MAX_RETRIES="${MAX_RETRIES:-5}"
RETRY_DELAY_SECONDS="${RETRY_DELAY_SECONDS:-10}"

for ((attempt = 1; attempt <= MAX_RETRIES; attempt++)); do
  echo "Attempt ${attempt}/${MAX_RETRIES}: verifying cosign signature for ${IMAGE}..."

  if cosign verify "${IMAGE}" \
    --certificate-oidc-issuer "${OIDC_ISSUER}" \
    --certificate-identity-regexp "${OIDC_IDENTITY_REGEXP}" \
    --certificate-github-workflow-repository "${GITHUB_WORKFLOW_REPOSITORY}"; then
    echo "✓ Verified signature on attempt ${attempt}"
    exit 0
  fi

  if ((attempt < MAX_RETRIES)); then
    echo "Signature not yet available; retrying in ${RETRY_DELAY_SECONDS}s..."
    sleep "${RETRY_DELAY_SECONDS}"
  fi
done

echo "::error::Failed to verify cosign signature for ${IMAGE} after ${MAX_RETRIES} attempts"
exit 1
