#!/usr/bin/env bash
set -euo pipefail

##
# Syncs the published invoke-gati-v2 artifacts from the source repository.
#
# The action's TypeScript source lives in smartcontractkit/.github-internal.
# Only the built output and its documentation are mirrored here, so every file
# this script writes is generated -- change it upstream, not in this repository.
#
# Synced:
#   README.md        (references to the source repository rewritten, see below)
#   action.yml
#   dist/index.js
#   dist/post.js
#   the "version" field of package.json
#
# Requires: gh, jq
#
# Usage:
#   ./scripts/sync.sh [--ref <ref>] [--token <github-token>]
#
#   --ref     Branch, tag, or commit to sync from. Defaults to "main".
#   --token   Token with read access to the source repository. Defaults to
#             GH_TOKEN, GITHUB_TOKEN, or whatever `gh auth` already resolves.
##

SRC_REPO="smartcontractkit/.github-internal"
SRC_PATH="actions/invoke-gati-v2"
DST_REPO="smartcontractkit/.github"

# Copied verbatim. The README is the one exception; see rewrite below.
FILES=(
  "README.md"
  "action.yml"
  "dist/index.js"
  "dist/post.js"
)

log() { echo "[gati-sync] $*"; }
err() { echo "[gati-sync][ERROR] $*" >&2; }
fail() {
  err "$1"
  exit 1
}

usage() { echo "Usage: $0 [--ref <ref>] [--token <github-token>]"; }

ref="main"
token=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      ref="${2:-}"
      [[ -n "$ref" ]] || {
        usage
        fail "--ref requires a value"
      }
      shift 2
      ;;
    --token)
      token="${2:-}"
      [[ -n "$token" ]] || {
        usage
        fail "--token requires a value"
      }
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage
      fail "unknown argument: $1"
      ;;
  esac
done

command -v gh >/dev/null || fail "gh is required: https://cli.github.com"
command -v jq >/dev/null || fail "jq is required: https://jqlang.github.io/jq"

[[ -n "$token" ]] && export GH_TOKEN="$token"

action_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Resolves against the source repository, not the checkout this script runs in.
fetch() {
  gh api "repos/$SRC_REPO/contents/$SRC_PATH/$1?ref=$ref" \
    -H "Accept: application/vnd.github.raw"
}

sha="$(gh api "repos/$SRC_REPO/commits?sha=$ref&per_page=1" --jq '.[0].sha')" ||
  fail "cannot resolve $SRC_REPO@$ref -- check the ref and the token's access"

log "syncing $SRC_REPO/$SRC_PATH@$ref ($sha)"

# Everything lands in a temp directory first so a mid-transfer failure cannot
# leave the action half-synced.
mkdir -p "$tmp/dist"
for file in "${FILES[@]}"; do
  log "fetching $file"
  fetch "$file" >"$tmp/$file"
done

log "fetching package.json"
version="$(fetch "package.json" | jq -r '.version')"
[[ -n "$version" && "$version" != "null" ]] ||
  fail "no version field in $SRC_PATH/package.json@$ref"

# The README documents how to consume the action, and consumers get it from the
# public repository rather than the private one it is built in.
if grep -qF "$SRC_REPO" "$tmp/README.md"; then
  log "rewriting README references: $SRC_REPO -> $DST_REPO"
  sed "s|${SRC_REPO//./\\.}|$DST_REPO|g" "$tmp/README.md" >"$tmp/README.md.rewritten"
  mv "$tmp/README.md.rewritten" "$tmp/README.md"
fi

mkdir -p "$action_dir/dist"
for file in "${FILES[@]}"; do
  mv "$tmp/$file" "$action_dir/$file"
done

log "setting version to $version"
jq --arg version "$version" '.version = $version' "$action_dir/package.json" \
  >"$tmp/package.json"
mv "$tmp/package.json" "$action_dir/package.json"

log "done -- review the diff before committing"
