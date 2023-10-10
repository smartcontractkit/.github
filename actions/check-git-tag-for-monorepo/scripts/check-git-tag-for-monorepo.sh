#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${TAG_REF:-}" ]]; then
    # This should equal ${{ github.ref_name }} from the workflow, e.g. producer@1.0.0
    echo "TAG_REF is not set. Exiting."
    exit 1
fi

echo "Checking if ${TAG_REF} matches the expected format of the monorepo tag: <name>@<version> ..."
if [[ "$TAG_REF" =~ ^[a-zA-Z0-9_.-]*@[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NAME=${TAG_REF%%@*}
    VERSION=${TAG_REF#*@}
    echo "Tag Format is a monorepo tag."
    echo "name=${NAME}" | tee -a "$GITHUB_OUTPUT"
    echo "version=${VERSION}" | tee -a "$GITHUB_OUTPUT"
    echo "release=true" | tee -a "$GITHUB_OUTPUT"
else
    echo "No monorepo tag found."
    echo "release=false" | tee -a "$GITHUB_OUTPUT"
fi
