#!/usr/bin/env bash
set -euo pipefail

SRC_ROOT="workflows"
DST_ROOT=".github/workflows"

usage() {
  echo "Usage: $0 check|fix [staged_files...]"
}

[[ $# -ge 1 ]] || { usage; exit 2; }
MODE="$1"; shift
[[ "$MODE" == "check" || "$MODE" == "fix" ]] || { usage; exit 2; }

mkdir -p "$DST_ROOT"

if [ "$GITHUB_ACTIONS" = "true" ]; then
  log()  { echo "::notice::[workflow-sync] $*"; }
  warn() { echo "::warning::[workflow-sync][WARN] $*"; }
  err()  { echo "::error::[workflow-sync][ERROR] $*" >&2; }
else
  log()  { echo "[workflow-sync] $*"; }
  warn() { echo "[workflow-sync][WARN] $*"; }
  err()  { echo "[workflow-sync][ERROR] $*" >&2; }
fi

# ------------------------------------------------------------
# Determine impacted workflow names from staged files
# ------------------------------------------------------------

declare -A impacted=()
have_args=0

if [[ $# -gt 0 ]]; then
  have_args=1
  for f in "$@"; do
    # workflows/<name>/<name>.yml
    if [[ "$f" == workflows/*/*.* ]]; then
      dir="$(basename "$(dirname "$f")")"
      file="$(basename "$f")"
      name="${file%.*}"
      if [[ "$dir" == "$name" ]]; then
        impacted["$name"]=1
      fi
    fi

    # .github/workflows/<name>.yml
    if [[ "$f" == .github/workflows/*.* ]]; then
      file="$(basename "$f")"
      name="${file%.*}"
      impacted["$name"]=1
    fi
  done
fi

# ------------------------------------------------------------
# Collect canonical sources
# workflows/<name>/<name>.yml|yaml
# ------------------------------------------------------------

mapfile -t SOURCES < <(
  find "$SRC_ROOT" -mindepth 2 -maxdepth 2 -type f \( -name "*.yml" -o -name "*.yaml" \) -print | sort
)

log "mode=$MODE args=$# sources=${#SOURCES[@]}"

# If called with args but none matched workflow patterns → exit cleanly
if [[ $have_args -eq 1 && ${#impacted[@]} -eq 0 ]]; then
  log "no impacted workflow pairs detected; exiting"
  exit 0
fi

is_impacted() {
  local name="$1"
  [[ $have_args -eq 0 ]] && return 0
  [[ -n "${impacted[$name]:-}" ]]
}

dst_overwrite_allowed() {
  local dst="$1"

  # Unstaged changes?
  if git diff --name-only -- "$dst" | grep -q .; then
    return 1
  fi

  # Staged changes allowed
  return 0
}

# ------------------------------------------------------------
# Main comparison loop
# ------------------------------------------------------------

strict_fail=0
warn_count=0
changed_count=0

for src in "${SOURCES[@]}"; do
  dir="$(basename "$(dirname "$src")")"
  file="$(basename "$src")"
  name="${file%.*}"

  # Only process workflows/<name>/<name>.yml
  [[ "$dir" == "$name" ]] || continue

  ext="${file##*.}"
  dst="$DST_ROOT/$name.$ext"

  tmp="$(mktemp)"

  {
    cat <<EOF
# GENERATED FILE - DO NOT EDIT DIRECTLY.
# Source: $src
# Edit the source under workflows/, then regenerate.

EOF
    cat "$src"
  } > "$tmp"

  needs_update=0
  if [[ ! -f "$dst" ]] || ! cmp -s "$tmp" "$dst"; then
    needs_update=1
  fi

  if [[ $needs_update -eq 1 ]]; then
    if is_impacted "$name"; then
      if [[ "$MODE" == "check" ]]; then
        err "out of sync: $dst (from $src)"
        strict_fail=1
        rm -f "$tmp"
      else
        if [[ -f "$dst" ]] && ! dst_overwrite_allowed "$dst"; then
          err "refusing to overwrite $dst (has unstaged changes)"
          strict_fail=1
          rm -f "$tmp"
        else
          log "update $dst (from $src)"
          mv "$tmp" "$dst"
          changed_count=$((changed_count + 1))
        fi
      fi
    else
      warn "out of sync (not in this commit): $dst"
      warn_count=$((warn_count + 1))
      rm -f "$tmp"
    fi
  else
    rm -f "$tmp"
  fi
done

# ------------------------------------------------------------
# Post-processing
# ------------------------------------------------------------

if [[ "$MODE" == "fix" && $changed_count -gt 0 ]]; then
  err "regenerated $changed_count file(s) under $DST_ROOT — please stage them:"
  err "  git add $DST_ROOT"
  exit 1
fi

if [[ $strict_fail -eq 1 ]]; then
  if [[ "$MODE" == "check" ]]; then
    err "impacted reusable workflows are out of sync."
    err "run: pnpm workflows:fix (tools/scripts/sync-reusable-workflows.sh fix)"
    err "then: git add $DST_ROOT"
  fi
  exit 1
fi

if [[ $warn_count -gt 0 ]]; then
  warn "$warn_count non-impacted workflow(s) are out of sync (not failing this commit)."
fi

log "OK"
exit 0
