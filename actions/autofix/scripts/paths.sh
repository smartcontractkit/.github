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

# in_paths reads file paths, one per line, from stdin and prints those the
# pathspecs in paths match. It matches with git itself, through a throwaway
# repository and index, so pathspec magic and deleted files work, and no
# checkout is needed.
in_paths() {
  local repo empty_blob
  repo="$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/autofix-paths.XXXXXX")"
  git init -q "${repo}"
  empty_blob="$(git -C "${repo}" hash-object -t blob /dev/null)"
  while IFS= read -r file; do
    if [[ -n "${file}" ]]; then
      printf '100644 %s\t%s\n' "${empty_blob}" "${file}"
    fi
  done | git -C "${repo}" update-index --index-info
  git -C "${repo}" -c core.quotePath=false ls-files -- "${paths[@]}"
  rm -rf "${repo}"
}
