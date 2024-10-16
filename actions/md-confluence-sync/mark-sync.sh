#!/usr/bin/env bash
set -euo pipefail

##
# Validation
##

if [[ -z "${FILES:-}" ]]; then
  echo "FILES is not set. Exiting."
  exit 1
fi

# $USER is the email address associated with the token.
if [[ -z "${USER:-}" ]]; then
  echo "USER is not set. Exiting."
  exit 1
fi

if [[ -z "${TOKEN:-}" ]]; then
  echo "TOKEN is not set. Exiting."
  exit 1
fi

if [[ -z "${BASE_URL:-}" ]]; then
  echo "BASE_URL is not set. Exiting."
  exit 1
fi

if [[ -z "${SPACE:-}" ]]; then
  echo "SPACE is not set. Exiting."
  exit 1
fi

if [[ -z "${PARENT:-}" ]]; then
  echo "PARENT is not set. Exiting."
  exit 1
fi

# Mermaid diagrams are rendered locally and inlined into the HTML artifact as PNGs.
mark -f "$FILES" \
  --edit-lock \
  --title-from-h1 \
  -u "$USER" \
  -p "$TOKEN" \
  -b "$BASE_URL" \
  --space "$SPACE" \
  --parents "$PARENT" \
  --mermaid-provider mermaid-go \
  --ci
