#!/usr/bin/env bash

# Sourced by the other scripts. Reads PATHS, git pathspecs relative to the
# repository root separated by newlines, into the paths array. Defaults to the
# whole repository.

paths=()
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  if [[ -n "${line}" ]]; then
    paths+=("${line}")
  fi
done <<<"${PATHS:-}"
if [[ ${#paths[@]} -eq 0 ]]; then
  paths=(.)
fi
