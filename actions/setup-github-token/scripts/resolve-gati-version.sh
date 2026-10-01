#!/usr/bin/env bash

# Selects between GATI v1 (assume an AWS role, then call the v1 lambda) and GATI
# v2 (GitHub OIDC, no AWS credentials), then emits the version and, for v2, the
# profile to request.

set -euo pipefail

PROFILE="${PROFILE:-}"
GATI_VERSION="${GATI_VERSION:-}"
AWS_ROLE_ARN="${AWS_ROLE_ARN:-}"
AWS_LAMBDA_URL="${AWS_LAMBDA_URL:-}"

VERSION=""
REASON=""

resolve_version() {
    if [[ -n "${GATI_VERSION}" ]]; then
        if [[ "${GATI_VERSION}" != "v1" && "${GATI_VERSION}" != "v2" ]]; then
            echo "::error::gati-version must be 'v1' or 'v2', got '${GATI_VERSION}'."
            exit 1
        fi
        VERSION="${GATI_VERSION}"
        REASON="gati-version input"
        return
    fi

    if [[ -n "${PROFILE}" ]]; then
        VERSION="v2"
        REASON="profile input"
        return
    fi

    # A repository pinned to both lists stays on v1, so that pinning a broken
    # repository back to v1 does not require also editing the v2 list.
    if grep -qxF "${GITHUB_REPOSITORY}" <<<"${FORCE_V1_REPOSITORIES}"; then
        VERSION="v1"
        REASON="repository is pinned to v1"
        return
    fi

    if grep -qxF "${GITHUB_REPOSITORY}" <<<"${FORCE_V2_REPOSITORIES}"; then
        VERSION="v2"
        REASON="repository is pinned to v2"
        return
    fi

    local bucket
    bucket=$(($(printf '%s' "${GITHUB_REPOSITORY}" | cksum | cut -d ' ' -f 1) % 100))
    REASON="bucket ${bucket}, rollout at ${ROLLOUT_PERCENTAGE}%"
    if ((bucket < ROLLOUT_PERCENTAGE)); then
        VERSION="v2"
    else
        VERSION="v1"
    fi
}

resolve_version

if [[ "${VERSION}" == "v1" && -n "${PROFILE}" ]]; then
    echo "::error::profile is only supported by GATI v2, but v1 was selected (${REASON}). Remove the profile input, or set gati-version to 'v2'."
    exit 1
fi

if [[ -z "${PROFILE}" ]]; then
    if [[ -z "${AWS_ROLE_ARN}" || -z "${AWS_LAMBDA_URL}" ]]; then
        echo "::error::aws-role-arn and aws-lambda-url are required when profile is not set."
        exit 1
    fi
    # Only read by the v2 flow, which migrates a v1 role ARN as a v1 profile.
    PROFILE="v1/${AWS_ROLE_ARN}"
fi

echo "Using GATI ${VERSION} (${REASON})."
echo "version=${VERSION}" >>"$GITHUB_OUTPUT"

if [[ "${VERSION}" == "v2" ]]; then
    # Written without tee: the profile can embed an IAM role ARN.
    echo "profile=${PROFILE}" >>"$GITHUB_OUTPUT"
fi
