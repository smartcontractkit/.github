#!/bin/bash
set -e

# Check if running in dry run mode
DRY_RUN=${DRY_RUN:-false}

# Check for dependencies
if ! command -v go &> /dev/null; then
    echo "::error::'go' command not found."
    exit 1
fi

# Validate environment variables
if [[ -z "${OVERRIDES}" ]]; then
    echo "::info:: No go get overrides specified, skipping."
    exit 0
fi

echo "::info:: Processing go get overrides..."

while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines
    [[ -z "$line" ]] && continue

    # Extract dependency name and SHA
    dependency="${line%%=*}"
    sha="${line#*=}"

    # Skip if SHA is empty
    if [[ -z "$sha" ]]; then
        echo "::warning::Empty SHA for dependency $dependency, skipping."
        continue
    fi

    echo "::info:: Replacing $dependency dependency with SHA: $sha"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY RUN] Would execute: go get \"github.com/smartcontractkit/${dependency}@${sha}\""
    else
        # Set GOPRIVATE if provided
        if [[ -n "${GOPRIVATE}" ]]; then
            export GOPRIVATE="${GOPRIVATE}"
        fi

        go get "github.com/smartcontractkit/${dependency}@${sha}" || {
            echo "Error: Failed to get dependency github.com/smartcontractkit/${dependency}@${sha}"
            exit 1
        }
        echo "::info::Successfully updated ${dependency} to ${sha}"
    fi
done <<< "$OVERRIDES"

echo "Go get overrides processing completed."
