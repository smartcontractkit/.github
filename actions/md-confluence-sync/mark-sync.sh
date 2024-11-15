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

if [[ -z "${DEFAULT_BRANCH:-}" ]]; then
  echo "::error::DEFAULT_BRANCH is not set. Exiting."
  exit 1
fi



# Prepends disclaimer banner
function prepend_disclaimer_banner() {
  # Enable recursive globbing
  shopt -s globstar

  # Loop over each file matching the glob expression
  for file in $FILES; do
    edit_url="https://github.com/$GITHUB_REPOSITORY/blob/$DEFAULT_BRANCH/$file"
    # The syntax for disclaimer banner is based on this https://github.com/kovetskiy/mark?tab=readme-ov-file#insert-colored-text-box
    disclaimer_banner="<!-- Macro: :disclaimer-box:([^:]+):([^:]*):(.+):
     Template: ac:box
     Icon: true
     Name: \${1}
     Title: \${2}
     Body: \${3} -->

:disclaimer-box:note:Caution:This page is managed in github! Do not edit here! [Edit in Github](${edit_url}):
"

    # Prepend the text block to the file using a temporary file
    { echo "$disclaimer_banner"; cat "$file"; } > temp_file && mv temp_file "$file"
  done

  # Disable globstar after we're done (optional)
  shopt -u globstar
}

function publish_to_confluence() {
  # Mermaid diagrams are rendered locally and inlined into the HTML artifact as PNGs.
  mark -f "$FILES" \
    --title-from-h1 \
    -u "$USER" \
    -p "$TOKEN" \
    -b "$BASE_URL" \
    --space "$SPACE" \
    --parents "$PARENT" \
    --mermaid-provider mermaid-go \
    --ci
}

prepend_disclaimer_banner
publish_to_confluence