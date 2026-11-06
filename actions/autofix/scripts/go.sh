#!/usr/bin/env bash

# Runs the Go fixers: go mod tidy, go fix, go fmt, then go generate, so
# generated code comes from the fixed sources, and go mod tidy again (fix and
# generate can change imports).
#
#   go.sh modules            prints the Go modules in PATHS below the current directory
#   go.sh fix                fixes the module in the current directory
#   go.sh fix --recursive    fixes every module in PATHS below the current directory
#   go.sh targets            prints the modules fix --recursive fixes
#   go.sh lint [--recursive] runs golangci-lint --fix in the modules fix would fix,
#                            exiting 1 when issues remain, 2 or more when it failed
#
# PATHS are git pathspecs relative to the repository root, separated by
# newlines, and default to the whole repository. Modules are printed relative
# to the repository root, the root module as ".".
#
# When CHANGED_FILES_KNOWN is "true", CHANGED_FILES lists the files the pull
# request changed, relative to the repository root, one per line. Only the
# modules owning one of them are then fixed, along with the modules that
# replace those with a local path, since their go.mod can need tidying too.
#
# lint passes GOLANGCI_LINT_CONFIG, a path relative to the repository root, as
# --config when set. Otherwise, modules golangci-lint finds no config in or
# above get GOLANGCI_LINT_DEFAULT_CONFIG, an absolute path, when set.
# GOLANGCI_LINT_ARGS, split on whitespace, are passed to every run.

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

# The modules in $1 that replace a module with a local path, as "module target"
# pairs. Targets outside the repository are left out.
replaces() {
  local root module target
  root="$(pwd -P)"
  for module in $1; do
    go mod edit -json "${module}/go.mod" | jq -r '.Replace[]?.New.Path' |
      while IFS= read -r target; do
        [[ "${target}" == ./* || "${target}" == ../* ]] || continue
        target="$(cd "${module}/${target}" 2>/dev/null && pwd -P)" || continue
        if [[ "${target}" == "${root}" ]]; then
          echo "${module} ."
        elif [[ "${target}" == "${root}/"* ]]; then
          echo "${module} ${target#"${root}/"}"
        fi
      done
  done
}

# The modules in $1 owning a file in CHANGED_FILES, each file's deepest one,
# then every module replacing one of those with a local path, until none are
# added.
changed() {
  local all="$1" selected="" file module best len best_len target added=true
  while IFS= read -r file; do
    [[ -n "${file}" ]] || continue
    best=""
    best_len=-1
    for module in ${all}; do
      if [[ "${module}" == "." ]]; then
        len=0
      elif [[ "${file}" == "${module}/"* ]]; then
        len="${#module}"
      else
        continue
      fi

      if ((len > best_len)); then
        best="${module}"
        best_len="${len}"
      fi
    done

    if [[ -n "${best}" ]]; then
      selected+="${best}"$'\n'
    fi
  done <<<"${CHANGED_FILES:-}"

  local edges
  edges="$(replaces "${all}")"
  while [[ "${added}" == "true" ]]; do
    added=false
    while read -r module target; do
      [[ -n "${module}" ]] || continue
      if grep -qxF -- "${target}" <<<"${selected}" && ! grep -qxF -- "${module}" <<<"${selected}"; then
        selected+="${module}"$'\n'
        added=true
      fi
    done <<<"${edges}"
  done

  for module in ${all}; do
    if grep -qxF -- "${module}" <<<"${selected}"; then
      echo "${module}"
    fi
  done
}

# The modules the Go fixers fix with --recursive.
targets() {
  local all
  all="$(modules)"
  if [[ "${CHANGED_FILES_KNOWN:-false}" == "true" && -n "${all}" ]]; then
    changed "${all}"
  else
    echo "${all}"
  fi
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

# Fixes what golangci-lint can in the module, and prints the issues left, with
# paths relative to the repository root so they annotate the right files.
lint() {
  local module="$1" root args=() rc=0
  root="$(pwd -P)"
  # Relative paths depend on where the config is, so print absolute ones and
  # strip the repository root.
  args+=("--path-mode=abs")
  # Report every issue, not only the first few of each kind, so one run shows
  # all there is to fix.
  args+=("--max-same-issues=0" "--max-issues-per-linter=0")
  if [[ -n "${GOLANGCI_LINT_CONFIG:-}" ]]; then
    args+=("--config=${root}/${GOLANGCI_LINT_CONFIG}")
  elif [[ -n "${GOLANGCI_LINT_DEFAULT_CONFIG:-}" ]] && ! (cd "${module}" && golangci-lint config path >/dev/null 2>&1); then
    args+=("--config=${GOLANGCI_LINT_DEFAULT_CONFIG}")
  fi

  # shellcheck disable=SC2206 # Split on purpose, like a command line.
  args+=(${GOLANGCI_LINT_ARGS:-})

  echo "::group::golangci-lint ${module}"
  (
    cd "${module}" || exit 2
    set -x
    golangci-lint run --fix "${args[@]}" ./... 2>&1 | sed "s#^${root}/##"
    exit "${PIPESTATUS[0]}"
  ) || rc=$?
  echo "::endgroup::"
  return "${rc}"
}

# The modules to run in: the one at the current directory, or with --recursive
# the targets. Exits when there are none.
modules_for() {
  local recursive="$1" what="$2" selected
  if [[ "${recursive}" != "--recursive" ]]; then
    echo "${dir}"
    return
  fi

  if [[ -z "$(modules)" ]]; then
    echo "::error::no Go modules found in ${paths[*]} below '${dir}'." >&2
    exit 1
  fi

  selected="$(targets)"
  if [[ -z "${selected}" ]]; then
    echo "::notice::The pull request changed no Go modules, skipping ${what}." >&2
  fi

  echo "${selected}"
}

case "${1:-}" in
  modules)
    modules
    ;;
  targets)
    targets
    ;;
  fix)
    targets="$(modules_for "${2:-}" "the Go fixers")"
    for module in ${targets}; do
      fix "${module}"
    done
    ;;
  lint)
    targets="$(modules_for "${2:-}" "golangci-lint")"
    status=0
    for module in ${targets}; do
      rc=0
      lint "${module}" || rc=$?
      if ((rc > 1)); then
        exit "${rc}"
      fi

      if ((rc == 1)); then
        status=1
      fi
    done

    exit "${status}"
    ;;
  *)
    echo "usage: $0 modules | targets | fix [--recursive] | lint [--recursive]" >&2
    exit 2
    ;;
esac
