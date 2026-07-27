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

  # Reject local filesystem targets (not safe in CI)
  if [[ "$sha" == /* || "$sha" == ./* || "$sha" == ../* ]]; then
    echo "::error::Invalid override ref (local filesystem paths are not allowed): ${sha}"
    exit 1
  fi

  echo "Overriding Go module version: ${module}@${sha}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY RUN] go get \"${module}@${sha}\""
  else
    go get "${module}@${sha}"
  fi
done <<< "$GO_OVERRIDES"


if [[ "${DRY_RUN}" != "true" ]]; then
  go mod tidy
fi
