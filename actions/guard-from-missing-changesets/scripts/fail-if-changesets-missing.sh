#!/usr/bin/env bash
set -euo pipefail

##
# Check if the files within .changesets/ are missing compared to the trunk branch.
##

if [[ -z "${TRUNK_BRANCH:-}" ]]; then
    echo "::error::TRUNK_BRANCH environment variable is required. Exiting..."
    exit 1
fi

# Check if '@changesets/cli' exists as a local package
if [[ -f './node_modules/.bin/changeset' ]]; then
    echo "Running locally installed changeset status..."
    yarn changeset status --since="${TRUNK_BRANCH}"
# Check if 'changeset' command exists globally
elif command -v changeset > /dev/null 2>&1; then
    echo "Running globally installed changeset status..."
    changeset status --since="${TRUNK_BRANCH}"
else
    echo "Error: @changesets/cli not found locally or globally."
    exit 1
fi
