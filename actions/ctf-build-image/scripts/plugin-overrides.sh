#!/bin/bash
set -e

# Check for dependencies
if ! command -v yq &> /dev/null; then
    echo "::error::'yq' command not found. Please install yq (https://github.com/mikefarah/yq)."
    exit 1
fi

# Validate environment variables
if [[ -z "${PLUGINS_MANIFEST_PATH}" ]]; then
    echo "::error::PLUGINS_MANIFEST_PATH environment variable is required."
    exit 1
fi

if [[ ! -f "$PLUGINS_MANIFEST_PATH" ]]; then
    echo "::info::Plugins manifest $PLUGINS_MANIFEST_PATH not found, skipping update."
    exit 0
fi

if [[ -z "${PLUGIN_OVERRIDES}" ]]; then
    echo "::info::No plugin manifest overrides specified, skipping."
    exit 0
fi

echo "::info::Processing plugin manifest overrides..."
updated_plugins_manifest=false

while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines
    [[ -z "$line" ]] && continue

    # Extract plugin name and SHA
    plugin="${line%%=*}"
    sha="${line#*=}"

    # Skip if SHA is empty
    if [[ -z "$sha" ]]; then
        echo "::warning::Empty SHA for plugin $plugin, skipping."
        continue
    fi

    # Verify plugin exists in manifest
    if ! yq e ".plugins.$plugin" "$PLUGINS_MANIFEST_PATH" &> /dev/null; then
        echo "::warning::Plugin '$plugin' not found in manifest, skipping."
        continue
    fi

    echo "::info::Updating plugins manifest with $plugin@${sha}"

    old_ref=$(yq e ".plugins.${plugin}[0].gitRef" "$PLUGINS_MANIFEST_PATH")
    echo "::info::Current gitRef for plugin $plugin is $old_ref"
    if [[ "${old_ref}" == "null" ]]; then
        echo "::warning::No gitRef found for plugin $plugin, skipping update."
        continue
    fi

    yq e ".plugins.${plugin}[0].gitRef = \"$sha\"" -i "$PLUGINS_MANIFEST_PATH" || {
        echo "::error::Failed to update plugin $plugin in manifest."
        exit 1
    }
    updated_plugins_manifest=true
    echo "Successfully updated $plugin to $sha"

done <<< "$PLUGIN_OVERRIDES"

if [[ "$updated_plugins_manifest" = true ]]; then
    echo "::info::Plugins manifest updated, contents:"
    cat "$PLUGINS_MANIFEST_PATH"
else
    echo "::info::No changes made to plugins manifest."
fi

echo "::info::Plugin manifest processing completed."
