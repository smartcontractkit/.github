#!/usr/bin/env bash

# Runs the Go fixers: go mod tidy, go fix, go fmt, then go generate, so
# generated code comes from the fixed sources, and go mod tidy again (fix and
# generate can change imports).
#
#   go.sh modules            prints the Go modules in PATHS below the current directory
#   go.sh fix                fixes the module in the current directory
#   go.sh fix --recursive    fixes every module in PATHS below the current directory
#
# PATHS are git pathspecs relative to the repository root, separated by
# newlines, and default to the whole repository. Modules are printed relative
# to the repository root, the root module as ".".

set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

prefix="$(git rev-parse --show-prefix)"
cd "$(git rev-parse --show-toplevel)"
# shellcheck source=SCRIPTDIR/paths.sh
source "${script_dir}/paths.sh"
dir="${prefix%/}"
dir="${dir:-.}"

# Every go.mod in PATHS that is tracked or not ignored, below the current
# directory, skipping directories the go tool ignores too: vendor, testdata,
# and those starting with "." or "_".
modules() {
  local ignored='/(vendor|testdata|[._][^/]*)/'
  local file rel
  git ls-files --cached --others --exclude-standard -- "${paths[@]}" |
    while IFS= read -r file; do
      [[ "${file}" == go.mod || "${file}" == */go.mod ]] || continue
      if [[ "${dir}" == "." ]]; then
        rel="${file}"
      elif [[ "${file}" == "${dir}/"* ]]; then
        rel="${file#"${dir}/"}"
      else
        continue
      fi
      if [[ ! "/${rel}" =~ ${ignored} ]]; then
        dirname "${file}"
      fi
    done |
    sort -u
}

fix() {
  local module="$1"
  if [[ ! -f "${module}/go.mod" ]]; then
    echo "::error::no go.mod found in '${module}'."
    exit 1
  fi

  echo "::group::${module}"
  (
    cd "${module}"
    set -x
    go mod tidy
    go fix ./...
    go fmt ./... >/dev/null
    go generate ./...
    go mod tidy
  )
  echo "::endgroup::"
}

case "${1:-}" in
  modules)
    modules
    ;;
  fix)
    if [[ "${2:-}" == "--recursive" ]]; then
      targets="$(modules)"
      if [[ -z "${targets}" ]]; then
        echo "::error::no Go modules found in ${paths[*]} below '${dir}'."
        exit 1
      fi
    else
      targets="${dir}"
    fi
    for module in ${targets}; do
      fix "${module}"
    done
    ;;
  *)
    echo "usage: $0 modules | fix [--recursive]" >&2
    exit 2
    ;;
esac
