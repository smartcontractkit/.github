#!/usr/bin/env bash
#
# Decide which bun version setup-bun should install, and how to tell it.
#
# setup-bun reads .tool-versions, .bun-version, and package.json natively via
# its own bun-version-file input, so this script forwards those to it unchanged.
# It does not understand mise.toml, which is where our TypeScript repos pin an
# exact bun, so this script reads mise files itself and emits a plain version.
#
# Inputs (env):
#   BUN_VERSION       explicit version; wins over everything, no file is read
#   BUN_VERSION_FILE  path to a version file; auto-detect when empty
#
# Outputs (GITHUB_OUTPUT):
#   version  pass to setup-bun's bun-version (empty when a file is forwarded)
#   file     pass to setup-bun's bun-version-file (empty when version is set)
#
# Exactly one of the two outputs is non-empty, or both are empty to let
# setup-bun read package.json itself and fall back to latest.

set -euo pipefail

BUN_VERSION="${BUN_VERSION:-}"
BUN_VERSION_FILE="${BUN_VERSION_FILE:-}"

# mise config file names, in the order mise itself prefers them.
MISE_PATHS=(mise.toml .mise.toml .config/mise/config.toml)
# Files setup-bun can read on its own. package.json is omitted deliberately:
# setup-bun already reads it when given no file at all.
FORWARDABLE_PATHS=(.tool-versions .bun-version)

# Print the bun entry of a mise [tools] table, in any of the forms mise
# accepts: a bare string, an array of versions, or a table with a version key.
mise_bun_line() {
  awk '
    /^[[:space:]]*\[/ { tools = ($0 ~ /^[[:space:]]*\[tools\][[:space:]]*$/); next }
    tools && /^[[:space:]]*("bun"|bun)[[:space:]]*=/ { print; exit }
  ' "$1"
}

# Reduce a mise bun entry to a bare version: drop the key, a trailing comment,
# the punctuation of all three forms, an inner `version =`, and any extra
# versions of the array form.
mise_bun_version() {
  local raw
  raw=$(mise_bun_line "$1")
  raw="${raw#*=}"
  raw="${raw%%#*}"
  raw=$(printf '%s' "${raw}" | tr -d "\"'[]{} ")
  raw="${raw##*=}"
  printf '%s' "${raw%%,*}"
}

is_mise_file() {
  case "$(basename "$1")" in
    mise.toml | .mise.toml | config.toml) return 0 ;;
    *) return 1 ;;
  esac
}

first_existing() {
  local candidate
  for candidate in "$@"; do
    if [[ -f "${candidate}" ]]; then
      printf '%s' "${candidate}"
      return
    fi
  done
}

out_version=""
out_file=""

if [[ -n "${BUN_VERSION}" ]]; then
  out_version="${BUN_VERSION}"
  echo "Using bun version from the bun-version input: ${out_version}"
else
  # Read a mise file if one is named or found; setup-bun cannot do it for us.
  if [[ -n "${BUN_VERSION_FILE}" ]]; then
    is_mise_file "${BUN_VERSION_FILE}" && mise_file="${BUN_VERSION_FILE}" || mise_file=""
  else
    mise_file=$(first_existing "${MISE_PATHS[@]}")
  fi

  if [[ -n "${mise_file}" ]]; then
    if [[ ! -f "${mise_file}" ]]; then
      echo "::error::bun-version-file '${mise_file}' does not exist"
      exit 1
    fi
    out_version=$(mise_bun_version "${mise_file}")
    if [[ -n "${out_version}" ]]; then
      echo "Using bun version from ${mise_file}: ${out_version}"
    elif [[ -n "${BUN_VERSION_FILE}" ]]; then
      # An explicitly named mise file must pin bun. An auto-detected one that
      # does not is skipped, so the other files still get a chance.
      echo "::error::bun-version-file '${mise_file}' does not pin a bun version"
      exit 1
    fi
  fi

  # No mise pin: hand a file setup-bun understands to setup-bun.
  if [[ -z "${out_version}" ]]; then
    if [[ -n "${BUN_VERSION_FILE}" ]]; then
      out_file="${BUN_VERSION_FILE}"
    else
      out_file=$(first_existing "${FORWARDABLE_PATHS[@]}")
    fi
    if [[ -n "${out_file}" ]]; then
      echo "Forwarding ${out_file} to setup-bun"
    else
      echo "No bun pin found; setup-bun will read package.json or install latest"
    fi
  fi
fi

{
  echo "version=${out_version}"
  echo "file=${out_file}"
} | tee -a "${GITHUB_OUTPUT}"
