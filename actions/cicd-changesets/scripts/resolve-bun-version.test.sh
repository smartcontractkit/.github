#!/usr/bin/env bash
#
# Tests for resolve-bun-version.sh. Run from this directory:
#   ./resolve-bun-version.test.sh

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/resolve-bun-version.sh"
passed=0
failed=0

# run_test_case <name> <setup-commands> <expected-version> <expected-file> \
#               <expected-exit> [BUN_VERSION] [BUN_VERSION_FILE]
#
# The setup commands run inside a scratch repo so each case sees only the files
# it creates.
run_test_case() {
  local name="$1" setup="$2" want_version="$3" want_file="$4" want_exit="$5"
  local bun_version="${6:-}" bun_version_file="${7:-}"
  local dir output rc got_version got_file github_output

  dir=$(mktemp -d)
  github_output=$(mktemp)
  (cd "${dir}" && eval "${setup}") >/dev/null

  output=$(cd "${dir}" && env \
    GITHUB_OUTPUT="${github_output}" \
    BUN_VERSION="${bun_version}" \
    BUN_VERSION_FILE="${bun_version_file}" \
    "${SCRIPT}" 2>&1)
  rc=$?

  got_version=$(grep "^version=" "${github_output}" | cut -d= -f2- | tr -d '\n')
  got_file=$(grep "^file=" "${github_output}" | cut -d= -f2- | tr -d '\n')

  if [[ "${got_version}" == "${want_version}" &&
    "${got_file}" == "${want_file}" &&
    "${rc}" == "${want_exit}" ]]; then
    echo "PASS  ${name}"
    passed=$((passed + 1))
  else
    echo "FAIL  ${name}"
    echo "      expected: version='${want_version}' file='${want_file}' exit=${want_exit}"
    echo "      got:      version='${got_version}' file='${got_file}' exit=${rc}"
    echo "      output:   ${output}"
    failed=$((failed + 1))
  fi

  rm -rf "${dir}" "${github_output}"
}

# --- mise files: read here, emitted as a version --------------------------
run_test_case "mise.toml bare string" \
  'printf "[tools]\nbun = \"1.3.14\"\n" > mise.toml' "1.3.14" "" 0
run_test_case "mise.toml table form" \
  'printf "[tools]\nbun = { version = \"1.3.14\" }\n" > mise.toml' "1.3.14" "" 0
run_test_case "mise.toml array form" \
  'printf "[tools]\nbun = [\"1.3.14\", \"1.2.0\"]\n" > mise.toml' "1.3.14" "" 0
run_test_case "mise.toml single quotes and comment" \
  "printf '[tools]\nbun = '\\''1.3.14'\\'' # pinned\n' > mise.toml" "1.3.14" "" 0
run_test_case "mise.toml quoted key" \
  'printf "[tools]\n\"bun\" = \"1.3.14\"\n" > mise.toml' "1.3.14" "" 0
run_test_case ".mise.toml" \
  'printf "[tools]\nbun = \"1.3.14\"\n" > .mise.toml' "1.3.14" "" 0
run_test_case ".config/mise/config.toml" \
  'mkdir -p .config/mise; printf "[tools]\nbun = \"1.3.14\"\n" > .config/mise/config.toml' \
  "1.3.14" "" 0
run_test_case "mise.toml without bun falls through" \
  'printf "[tools]\nnode = \"22\"\n" > mise.toml; printf "bun 1.3.14\n" > .tool-versions' \
  "" ".tool-versions" 0
run_test_case "mise.toml bun outside [tools] ignored" \
  'printf "[tasks]\nbun = \"echo hi\"\n" > mise.toml; printf "bun 1.3.14\n" > .tool-versions' \
  "" ".tool-versions" 0

# --- files setup-bun reads: forwarded ------------------------------------
run_test_case "auto-detect .tool-versions" \
  'printf "nodejs 22\nbun 1.3.14\n" > .tool-versions' "" ".tool-versions" 0
run_test_case "auto-detect .bun-version" \
  'printf "1.3.14\n" > .bun-version' "" ".bun-version" 0
run_test_case "mise preferred over .tool-versions" \
  'printf "[tools]\nbun = \"1.3.14\"\n" > mise.toml; printf "bun 1.2.0\n" > .tool-versions' \
  "1.3.14" "" 0
run_test_case "package.json left to setup-bun" \
  'printf "{\"engines\":{\"bun\":\">=1.3.14\"}}\n" > package.json' "" "" 0
run_test_case "no pin at all" \
  'printf "hi\n" > README.md' "" "" 0
run_test_case "explicit .tool-versions" \
  'printf "bun 1.3.14\n" > .tool-versions' "" ".tool-versions" 0 "" ".tool-versions"
run_test_case "explicit package.json" \
  'printf "{\"packageManager\":\"bun@1.3.14\"}\n" > package.json' "" "package.json" 0 "" "package.json"

# --- explicit input and explicit mise file -------------------------------
run_test_case "bun-version input wins" \
  'printf "[tools]\nbun = \"1.3.14\"\n" > mise.toml' "1.2.0" "" 0 "1.2.0"
run_test_case "explicit mise file in subdir" \
  'mkdir -p sub; printf "[tools]\nbun = \"1.3.14\"\n" > sub/mise.toml' \
  "1.3.14" "" 0 "" "sub/mise.toml"
run_test_case "explicit mise file without bun fails" \
  'printf "[tools]\nnode = \"22\"\n" > mise.toml' "" "" 1 "" "mise.toml"
run_test_case "explicit mise file missing fails" \
  'true' "" "" 1 "" "sub/mise.toml"

echo
echo "passed: ${passed}, failed: ${failed}"
[[ "${failed}" -eq 0 ]]
