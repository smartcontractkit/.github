#!/usr/bin/env bash
set -euo pipefail

# $USER is your smartcontract email
# $PASSWORD is the api token created on the https://id.atlassian.com/manage-profile/security/api-tokens page
# Mermaid diagrams are rendered locally and inlined into the HTML artifact as PNGs

mark -f "$FILES" \
  --edit-lock \
  --title-from-h1 \
  -u "$USER" \
  -p "$TOKEN" \
  -b "$BASE_URL" \
  --space "$SPACE" \
  --parents "$PARENT" \
  --mermaid-provider mermaid-go