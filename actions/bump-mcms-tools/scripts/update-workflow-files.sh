set -Eeuo pipefail
IFS=$'\n\t'

changed=false

echo "::notice::Searching for steps using pattern: $PATTERN"
echo "::notice::Latest version to set: $LATEST"
echo "::notice::Workflows regex: $WORKFLOWS_REGEX"

# Find workflow files
mapfile -d '' files < <(find . -regextype posix-extended -regex "$WORKFLOWS_REGEX" -type f -print0 || true)
total=${#files[@]}
echo "::notice::Found $total potential workflow file(s)"
if [[ $total -eq 0 ]]; then
  echo "::warning::No workflow files matched regex ($WORKFLOWS_REGEX)"
  echo "changed=$changed" | tee -a "$GITHUB_OUTPUT"
  exit 0
fi

for f in "${files[@]}"; do
  echo "::group::Processing $f"

  # Count steps that use the action
  match_count=$(yq -r '
    [
      .jobs[]?.steps[]?
      | select((.uses // "") | type == "!!str" and (.uses | test("^'"$PATTERN"'")))
    ] | length
  ' "$f")

  if [[ "$match_count" -eq 0 ]]; then
    echo "::notice::No steps using the action — skipping."
    echo "::endgroup::"
    continue
  fi

  # Count how many of those are NOT already at the latest version (missing or different)
  diff_count=$(yq -r '
    [
      .jobs[]?.steps[]?
      | select((.uses // "") | type == "!!str" and (.uses | test("^'"$PATTERN"'")))
      | (.with.version // "") | select(. != "'"$LATEST"'")
    ] | length
  ' "$f")

  # For visibility, list current distinct versions on matched steps
  echo "::notice::Matched steps: $match_count"
  echo "::notice::Current versions on matched steps:"
  yq -r '
    .jobs[]?.steps[]?
    | select((.uses // "") | type == "!!str" and (.uses | test("^'"$PATTERN"'")))
    | (.with.version // "<missing>")
  ' "$f" | sed 's/^/  - /'

  if [[ "$diff_count" -eq 0 ]]; then
    echo "::notice::↩️ All matched steps already at $LATEST — no update needed."
    echo "::endgroup::"
    continue
  fi

  before_hash=$(sha1sum "$f" | cut -d' ' -f1)

  # Patch ONLY matched steps
  yq -i '
    (.jobs[]?.steps[]?
     | select((.uses // "") | type == "!!str" and (.uses | test("^'"$PATTERN"'")))
     | .with.version) = "'"$LATEST"'"
  ' "$f"

  after_hash=$(sha1sum "$f" | cut -d' ' -f1)

  if [[ "$before_hash" != "$after_hash" ]]; then
    echo "::notice::✅ Updated $f → version set to $LATEST"
    changed=true
  else
    echo "::notice::↩️ No change detected after patch (already up-to-date/normalized)."
  fi

  echo "::endgroup::"
done

if [[ "$changed" == "true" ]]; then
  echo "::notice::Workflow(s) updated to $LATEST"
else
  echo "::notice::All relevant workflows already at latest version ($LATEST)"
fi

echo "changed=$changed" | tee -a "$GITHUB_OUTPUT"
