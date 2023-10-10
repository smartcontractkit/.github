#!/usr/bin/env bash
set -euo pipefail

##
# Checks for latest GitHub Release.
##

if [[ -z "${GH_REPO:-}" ]]; then
    echo "ERROR: GH_REPO environment variable is required. Exiting..."
    exit 1
fi
if [[ -z "${GH_TOKEN:-}" ]]; then
    echo "ERROR: GH_TOKEN environment variable is required. Exiting..."
    exit 1
fi
if [[ -z "${LIMIT:-}" ]]; then
    echo "ERROR: LIMIT environment variable is required. Exiting..."
    exit 1
fi
if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
    echo "ERROR: GITHUB_OUTPUT environment variable is required. Possibly not running within a GitHub Action. Exiting..."
    exit 1
fi

LATEST_RELEASE=$(gh release list \
    --exclude-drafts \
    --exclude-pre-releases \
    --limit "${LIMIT}" \
    --repo "${GH_REPO}" \
    | awk '$2=="Latest"')

if [[ -z "${LATEST_RELEASE:-}" ]]; then
    echo "::error::No latest release found"
    exit 1
fi
TITLE=$(echo "${LATEST_RELEASE}" | awk '{print $1}')
echo "title=${TITLE}" >> "${GITHUB_OUTPUT}"
TAG_NAME=$(echo "${LATEST_RELEASE}" | awk '{print $3}')
echo "tag-name=${TAG_NAME}" >> "${GITHUB_OUTPUT}"
PUBLISHED=$(echo "${LATEST_RELEASE}" | awk '{print $4}')
echo "published=${PUBLISHED}" >> "${GITHUB_OUTPUT}"
