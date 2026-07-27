#!/bin/bash
set -e

# Applies Go dependency overrides
# Env inputs: GO_OVERRIDES

if [[ -z "${GO_OVERRIDES}" ]]; then
  echo "No Go dependency overrides provided."
  exit 0
fi

echo "Applying Go dependency overrides..."
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  if [[ "$line" != *"="* ]]; then
    echo "::warning::Skipping malformed override line (missing '='): ${line}"
    continue
  fi

  dep="${line%%=*}"
  sha="${line#*=}"
  [[ -z "$dep" || -z "$sha" ]] && continue

  # Qualify module name if short name provided
  if [[ "$dep" != *"/"* ]]; then
    module="github.com/smartcontractkit/${dep}"
  else
    module="${dep}"
  fi

  if [[ "$module" != github.com/smartcontractkit/* ]]; then
    echo "::error::Unauthorized override (must target github.com/smartcontractkit/*): ${module}"
    exit 1
  fi

  if [[ "$sha" == *"/"* ]]; then
    if [[ "$sha" != github.com/smartcontractkit/*@* ]]; then
      echo "::error::Invalid replace target (expected github.com/smartcontractkit/*@<ref>): ${sha}"
      exit 1
    fi
    replace_target="$sha"
  else
    replace_target="${module}@${sha}"
  fi

  echo "Replacing Go module: ${module} -> ${replace_target}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY RUN] go mod edit -replace \"${module}=${replace_target}\""
  else
    go mod edit -replace "${module}=${replace_target}"
  fi
done <<< "$GO_OVERRIDES"

if [[ "${DRY_RUN}" != "true" ]]; then
  go mod tidy
fi
