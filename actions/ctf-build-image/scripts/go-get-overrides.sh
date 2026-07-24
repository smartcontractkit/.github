#!/bin/bash
set -e

# Applies Go dependency overrides via `go mod edit -replace`
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

  module="${line%%=*}"
  override="${line#*=}"
  [[ -z "$module" || -z "$override" ]] && continue

  echo "Replacing Go module: ${module} -> ${override}"
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY RUN] go mod edit -replace ${module}=${override}"
  else
    go mod edit -replace "${module}=${override}"
  fi
done <<< "$GO_OVERRIDES"

if [[ "${DRY_RUN}" != "true" ]]; then
  go mod tidy
fi
