#!/usr/bin/env bash
#
# Tests for resolve-versions.sh. Run from this directory:
#   ./resolve-versions.test.sh

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/resolve-versions.sh"
passed=0
failed=0

# run_test_case <name> <setup-commands> <expected-node-version> \
#               <expected-node-file> <expected-pnpm> <expected-exit> \
#               [NODE_VERSION] [NODE_VERSION_FILE] [PNPM_VERSION]
#
# The setup commands run inside a scratch repo so each case sees only the files
# it creates.
run_test_case() {
  local name="$1" setup="$2" want_node_version="$3" want_node_file="$4"
  local want_pnpm="$5" want_exit="$6"
  local node_version="${7:-}" node_version_file="${8:-}" pnpm_version="${9:-}"
  local dir output rc got_node_version got_node_file got_pnpm github_output

  dir=$(mktemp -d)
  github_output=$(mktemp)
  (cd "${dir}" && eval "${setup}") >/dev/null

  output=$(cd "${dir}" && env \
    GITHUB_OUTPUT="${github_output}" \
    NODE_VERSION="${node_version}" \
    NODE_VERSION_FILE="${node_version_file}" \
    PNPM_VERSION="${pnpm_version}" \
    PNPM_FALLBACK="^12.0.0" \
    "${SCRIPT}" 2>&1)
  rc=$?

  got_node_version=$(grep "^node-version=" "${github_output}" | cut -d= -f2- | tr -d '\n')
  got_node_file=$(grep "^node-version-file=" "${github_output}" | cut -d= -f2- | tr -d '\n')
  got_pnpm=$(grep "^pnpm-version=" "${github_output}" | cut -d= -f2- | tr -d '\n')

  if [[ "${got_node_version}" == "${want_node_version}" &&
    "${got_node_file}" == "${want_node_file}" &&
    "${got_pnpm}" == "${want_pnpm}" &&
    "${rc}" == "${want_exit}" ]]; then
    echo "PASS  ${name}"
    passed=$((passed + 1))
  else
    echo "FAIL  ${name}"
    echo "      expected: node-version='${want_node_version}' node-version-file='${want_node_file}' pnpm-version='${want_pnpm}' exit=${want_exit}"
    echo "      got:      node-version='${got_node_version}' node-version-file='${got_node_file}' pnpm-version='${got_pnpm}' exit=${rc}"
    echo "      output:   ${output}"
    failed=$((failed + 1))
  fi

  rm -rf "${dir}" "${github_output}"
}

# --- mise files: read here, emitted as a version ---------------------------
run_test_case "mise.toml bare strings" \
  'printf "[tools]\nnode = \"26.10.0\"\npnpm = \"12.9.1\"\n" > mise.toml' \
  "26.10.0" "" "12.9.1" 0
run_test_case "mise.toml table form" \
  'printf "[tools]\nnode = { version = \"26.10.0\" }\n" > mise.toml' \
  "26.10.0" "" "^12.0.0" 0
run_test_case "mise.toml array form" \
  'printf "[tools]\nnode = [\"26.10.0\", \"26.9.0\"]\n" > mise.toml' \
  "26.10.0" "" "^12.0.0" 0
run_test_case "mise.toml single quotes and comment" \
  "printf '[tools]\nnode = '\\''26.10.0'\\'' # pinned\n' > mise.toml" \
  "26.10.0" "" "^12.0.0" 0
run_test_case "mise.toml quoted keys" \
  'printf "[tools]\n\"node\" = \"26.10.0\"\n\"pnpm\" = \"12.9.1\"\n" > mise.toml' \
  "26.10.0" "" "12.9.1" 0
run_test_case ".mise.toml" \
  'printf "[tools]\nnode = \"26.10.0\"\n" > .mise.toml' \
  "26.10.0" "" "^12.0.0" 0
run_test_case ".config/mise/config.toml" \
  'mkdir -p .config/mise; printf "[tools]\nnode = \"26.10.0\"\n" > .config/mise/config.toml' \
  "26.10.0" "" "^12.0.0" 0
run_test_case "mise.toml node outside [tools] ignored" \
  'printf "[tasks]\nnode = \"echo hi\"\n" > mise.toml; printf "nodejs 26.10.0\n" > .tool-versions' \
  "" ".tool-versions" "^12.0.0" 0
run_test_case "mise.toml pnpm outside [tools] ignored" \
  'printf "[tasks]\npnpm = \"echo hi\"\n" > mise.toml' \
  "" "" "^12.0.0" 0
run_test_case "node from mise, pnpm from .tool-versions" \
  'printf "[tools]\nnode = \"26.10.0\"\n" > mise.toml; printf "pnpm 12.9.1\n" > .tool-versions' \
  "26.10.0" "" "12.9.1" 0

# --- files setup-node reads: forwarded ------------------------------------
run_test_case "auto-detect .tool-versions" \
  'printf "nodejs 26.10.0\npnpm 12.9.1\n" > .tool-versions' \
  "" ".tool-versions" "12.9.1" 0
run_test_case "auto-detect .nvmrc" \
  'printf "26.10.0\n" > .nvmrc' \
  "" ".nvmrc" "^12.0.0" 0
run_test_case "mise preferred over .tool-versions" \
  'printf "[tools]\nnode = \"26.10.0\"\npnpm = \"12.9.1\"\n" > mise.toml; printf "nodejs 22\npnpm 10\n" > .tool-versions' \
  "26.10.0" "" "12.9.1" 0
run_test_case "package.json left to setup-node" \
  'printf "{\"engines\":{\"node\":\">=26\"}}\n" > package.json' \
  "" "" "^12.0.0" 0
run_test_case "no pin at all" \
  'printf "hi\n" > README.md' \
  "" "" "^12.0.0" 0
run_test_case "tool-versions without pnpm falls back" \
  'printf "nodejs 26.10.0\n" > .tool-versions' \
  "" ".tool-versions" "^12.0.0" 0

# --- explicit inputs and explicit files -----------------------------------
run_test_case "node-version input wins" \
  'printf "[tools]\nnode = \"26.10.0\"\n" > mise.toml' \
  "24.0.0" "" "^12.0.0" 0 "24.0.0"
run_test_case "pnpm-version input wins" \
  'printf "[tools]\npnpm = \"12.9.1\"\n" > mise.toml' \
  "" "" "10.0.0" 0 "" "" "10.0.0"
run_test_case "explicit .tool-versions" \
  'printf "nodejs 26.10.0\npnpm 12.9.1\n" > .tool-versions' \
  "" ".tool-versions" "12.9.1" 0 "" ".tool-versions"
run_test_case "explicit .nvmrc" \
  'printf "26.10.0\n" > .nvmrc' \
  "" ".nvmrc" "^12.0.0" 0 "" ".nvmrc"
run_test_case "explicit mise file in subdir" \
  'mkdir -p sub; printf "[tools]\nnode = \"26.10.0\"\npnpm = \"12.9.1\"\n" > sub/mise.toml' \
  "26.10.0" "" "12.9.1" 0 "" "sub/mise.toml"
run_test_case "explicit mise file without node fails" \
  'printf "[tools]\npnpm = \"12.9.1\"\n" > mise.toml' \
  "" "" "" 1 "" "mise.toml"
run_test_case "explicit mise file missing fails" \
  'true' \
  "" "" "" 1 "" "sub/mise.toml"

echo
echo "passed: ${passed}, failed: ${failed}"
[[ "${failed}" -eq 0 ]]
