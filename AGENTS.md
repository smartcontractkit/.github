# .github

Repo for commonly used GitHub actions across the smartcontractkit GitHub org.

## Rules

- Prefer typescript over bash in the majority of cases. Exceptions being
  composite actions or super simple steps where bash is clearly superior.
- Prefer `| tee -a "${GITHUB_OUTPUT}"` (or `| tee -a "$GITHUB_OUTPUT"`) instead
  of `>> "$GITHUB_OUTPUT"` for redirecting outputs
