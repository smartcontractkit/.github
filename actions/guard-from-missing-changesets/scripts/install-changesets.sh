#!/usr/bin/env bash
set -euo pipefail

##
# Install changesets cli
##

if [[ -f './node_modules/.bin/changeset' ]] || command -v changeset > /dev/null 2>&1; then
    echo "::debug::@changesets/cli package already installed. Exiting..."
    exit 0
fi

# Check if package.json exists and if so, check for @changesets/cli in devDependencies and dependencies
if [[ -f ./package.json ]]; then
    # Check for "@changesets/cli" in devDependencies first
    version=$(jq -r '.devDependencies["@changesets/cli"] // empty' ./package.json)
    echo "::debug::devDependencies @changesets/cli version: ${version}"

    # If not found in devDependencies, check in dependencies
    if [[ -z "${version:-}" ]]; then
        version=$(jq -r '.dependencies["@changesets/cli"] // empty' ./package.json)
        echo "::debug::dependencies @changesets/cli version: ${version}"
    fi
else
    echo "::debug::./package.json not found"
fi

# If version is found, use it to install; otherwise, install the latest version
if [[ -z "${version:-}" ]]; then
    yarn global add @changesets/cli
else
    yarn global add "@changesets/cli@${version}"
fi
