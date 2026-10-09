#!/usr/bin/env bash
#
# Resolve the node and pnpm versions setup-nodejs should install.
#
# setup-node reads .tool-versions, .nvmrc, and package.json natively via its
# node-version-file input, so those are forwarded to it unchanged. It does not
# understand mise.toml, which is where our repos pin an exact node and pnpm,
# so this script reads mise files itself and emits plain versions.
#
# Inputs (env):
#   NODE_VERSION       explicit node version; wins over everything, no file is read
#   NODE_VERSION_FILE  path to a node version file; auto-detect when empty
#   PNPM_VERSION       explicit pnpm version; wins over every file
#   PNPM_FALLBACK      pnpm version to use when no pin is found
#
# Outputs (GITHUB_OUTPUT):
#   node-version       plain version for setup-node's node-version input
#                      (empty when a file is forwarded)
#   node-version-file  pass to setup-node's node-version-file input (empty
#                      when a version is set)
#   pnpm-version       pnpm version to install, never empty
#
# Exactly one of node-version / node-version-file is non-empty, or both are
# empty to let setup-node fall back to its own default.

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-}"
NODE_VERSION_FILE="${NODE_VERSION_FILE:-}"
PNPM_VERSION="${PNPM_VERSION:-}"
PNPM_FALLBACK="${PNPM_FALLBACK:-}"

# mise config file names, in the order mise itself prefers them.
MISE_PATHS=(mise.toml .mise.toml .config/mise/config.toml)
# Files setup-node reads on its own. package.json is omitted deliberately:
# setup-node already reads it when given no file at all.
FORWARDABLE_PATHS=(.tool-versions .nvmrc)

# Print the entry of a mise [tools] table for the given tool, in any of the
# forms mise accepts: a bare string, an array of versions, or a table with a
# version key.
mise_tool_line() {
  local file="$1" tool="$2"
  awk -v tool="$tool" '
    /^[[:space:]]*\[/ { tools = ($0 ~ /^[[:space:]]*\[tools\][[:space:]]*$/); next }
    $0 ~ ("^[[:space:]]*(\"" tool "\"|" tool ")[[:space:]]*=") { if (tools) { print; exit } }
  ' "$file"
}

# Reduce a mise tool entry to a bare version: drop the key, a trailing comment,
# the punctuation of all three forms, an inner `version =`, and any extra
# versions of the array form.
mise_tool_version() {
  local raw
  raw=$(mise_tool_line "$1" "$2")
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

# Pick the mise file to read tools from: an explicitly named one, or
# auto-detect. Both node and pnpm are read from the same file.
mise_file=""
if [[ -n "${NODE_VERSION_FILE}" ]]; then
  is_mise_file "${NODE_VERSION_FILE}" && mise_file="${NODE_VERSION_FILE}"
else
  mise_file=$(first_existing "${MISE_PATHS[@]}")
fi

out_node_version=""
out_node_file=""

if [[ -n "${NODE_VERSION}" ]]; then
  out_node_version="${NODE_VERSION}"
  echo "Using node version from the node-version input: ${out_node_version}"
else
  if [[ -n "${mise_file}" ]]; then
    if [[ ! -f "${mise_file}" ]]; then
      echo "::error::node-version-file '${mise_file}' does not exist"
      exit 1
    fi
    out_node_version=$(mise_tool_version "${mise_file}" node)
    if [[ -n "${out_node_version}" ]]; then
      echo "Using node version from ${mise_file}: ${out_node_version}"
    elif [[ -n "${NODE_VERSION_FILE}" ]]; then
      # An explicitly named mise file must pin node. An auto-detected one that
      # does not is skipped, so the other files still get a chance.
      echo "::error::node-version-file '${mise_file}' does not pin a node version"
      exit 1
    fi
  fi

  # No mise pin: hand a file setup-node understands to setup-node.
  if [[ -z "${out_node_version}" ]]; then
    if [[ -n "${NODE_VERSION_FILE}" ]]; then
      out_node_file="${NODE_VERSION_FILE}"
    else
      out_node_file=$(first_existing "${FORWARDABLE_PATHS[@]}")
    fi
    if [[ -n "${out_node_file}" ]]; then
      echo "Forwarding ${out_node_file} to setup-node"
    else
      echo "No node pin found; setup-node will use its default"
    fi
  fi
fi

out_pnpm=""

if [[ -n "${PNPM_VERSION}" ]]; then
  out_pnpm="${PNPM_VERSION}"
  echo "Using pnpm version from the pnpm-version input: ${out_pnpm}"
else
  if [[ -n "${mise_file}" ]]; then
    out_pnpm=$(mise_tool_version "${mise_file}" pnpm)
    if [[ -n "${out_pnpm}" ]]; then
      echo "Using pnpm version from ${mise_file}: ${out_pnpm}"
    fi
  fi

  if [[ -z "${out_pnpm}" && -f ".tool-versions" ]]; then
    out_pnpm=$(grep '^pnpm ' ".tool-versions" | cut -d' ' -f2- || true)
    if [[ -n "${out_pnpm}" ]]; then
      echo "Using pnpm version from .tool-versions: ${out_pnpm}"
    fi
  fi

  if [[ -z "${out_pnpm}" ]]; then
    echo "No pnpm version pin found. Using default version."
    out_pnpm="${PNPM_FALLBACK}"
  fi
fi

{
  echo "node-version=${out_node_version}"
  echo "node-version-file=${out_node_file}"
  echo "pnpm-version=${out_pnpm}"
} | tee -a "${GITHUB_OUTPUT}"
