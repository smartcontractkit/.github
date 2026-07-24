#!/bin/bash
set -e

# Applies plugin manifest overrides via yq
# Env inputs: PLUGIN_OVERRIDES, PLUGINS_MANIFEST_PATH

if [[ -z "${PLUGIN_OVERRIDES}" ]]; then
  echo "No plugin overrides provided. Skipping manifest processing."
  exit 0
fi

if [[ ! -f "${PLUGINS_MANIFEST_PATH}" && "${DRY_RUN}" != "true" ]]; then
  echo "Manifest file not found: ${PLUGINS_MANIFEST_PATH}"
  exit 1
fi

echo "Applying plugin manifest overrides..."
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  if [[ "$line" != *"="* ]]; then
    echo "::warning::Skipping malformed override line (missing '='): ${line}"
    continue
  fi

  plugin="${line%%=*}"
  gitref="${line#*=}"
  [[ -z "$plugin" || -z "$gitref" ]] && continue

  echo "Overriding plugin gitRef: ${plugin} -> ${gitref}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY RUN] yq eval -i '.plugins.${plugin}[0].gitRef = \"${gitref}\"' \"${PLUGINS_MANIFEST_PATH}\""
  else
    if ! yq e ".plugins.${plugin}" "${PLUGINS_MANIFEST_PATH}" &>/dev/null; then
      echo "::warning::Plugin '${plugin}' not found in manifest, skipping."
      continue
    fi
    yq eval -i ".plugins.${plugin}[0].gitRef = \"${gitref}\"" "${PLUGINS_MANIFEST_PATH}"
  fi
done <<< "$PLUGIN_OVERRIDES"
