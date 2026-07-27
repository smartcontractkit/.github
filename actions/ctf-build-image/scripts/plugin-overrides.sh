#!/bin/bash
set -e

# Check for dependencies (skip in dry run if yq missing)
if ! command -v yq &> /dev/null; then
    if [[ "${DRY_RUN}" != "true" ]]; then
        echo "::error::'yq' command not found. Please install yq (https://github.com/mikefarah/yq)."
        exit 1
    fi
fi

# Validate environment variables
if [[ -z "${PLUGINS_MANIFEST_PATH}" ]]; then
    echo "::error::PLUGINS_MANIFEST_PATH environment variable is required."
    exit 1
fi

if [[ ! -f "$PLUGINS_MANIFEST_PATH" && "${DRY_RUN}" != "true" ]]; then
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

    # Skip if line missing '=' or SHA is empty
    if [[ "$line" != *"="* ]] || [[ -z "$sha" ]]; then
        echo "::warning::Empty SHA or malformed override for plugin $plugin, skipping."
        continue
    fi

    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "[DRY RUN] Updating plugins manifest with $plugin@${sha}"
        echo "[DRY RUN] yq eval -i '.plugins[\"${plugin}\"][0].gitRef = \"${sha}\"' \"${PLUGINS_MANIFEST_PATH}\""
        updated_plugins_manifest=true
        continue
    fi

    # Verify plugin exists in manifest
    plugin_val=$(yq e ".plugins[\"${plugin}\"]" "$PLUGINS_MANIFEST_PATH" 2>/dev/null)
    if [[ "$plugin_val" == "null" || -z "$plugin_val" ]]; then
        echo "::warning::Plugin '$plugin' not found in manifest, skipping."
        continue
    fi


    echo "::info::Updating plugins manifest with $plugin@${sha}"

    old_ref=$(yq e ".plugins[\"${plugin}\"][0].gitRef" "$PLUGINS_MANIFEST_PATH")
    echo "::info::Current gitRef for plugin $plugin is $old_ref"
    if [[ "${old_ref}" == "null" ]]; then
        echo "::warning::No gitRef found for plugin $plugin, skipping update."
        continue
    fi

    yq e ".plugins[\"${plugin}\"][0].gitRef = \"$sha\"" -i "$PLUGINS_MANIFEST_PATH" || {
        echo "::error::Failed to update plugin $plugin in manifest."
        exit 1
    }
    updated_plugins_manifest=true
    echo "Successfully updated $plugin to $sha"

done <<< "$PLUGIN_OVERRIDES"

if [[ "$updated_plugins_manifest" = true ]]; then
    echo "::info::Plugins manifest updated, contents:"
    if [[ -f "$PLUGINS_MANIFEST_PATH" ]]; then
        cat "$PLUGINS_MANIFEST_PATH"
    fi
else
    echo "::info::No changes made to plugins manifest."
fi

echo "::info::Plugin manifest processing completed."
