# Proposal

## Why

`reusable-dependabump` only handles Go: it hard-codes `ecosystem=Go` in the
Dependabot alerts query, always sets up Go, and always runs Go-only tools
(`dependabot`, `gomods tidy`). Repos built on npm/pnpm, Rust (cargo), or Python
(pip/uv) get no automated vulnerability-bump PRs, and must copy and fork the
workflow to get them.

## What Changes

- Add an `ecosystem` input (comma-separated, default `go`) that selects which
  Dependabot alert ecosystems the workflow queries. Valid values follow the
  Dependabot alerts API (`go`, `npm`, `rust`, `pip`, and the others the API
  supports).
- Add a `bump-command` input. When set, the workflow runs it in place of the
  built-in Go bump. The command gets the filtered alerts as a JSON file whose
  path is in `DEPENDABUMP_ALERTS_FILE`.
- Keep the built-in Go bump (`dependabot` + `gomods tidy`) as the default when
  `bump-command` is empty and `ecosystem` is `go`. Fail validation when
  `bump-command` is empty and `ecosystem` includes anything other than `go`.
- Set up Go and install the Go tools only when the built-in Go bump runs.
- Skip the bump (`changed=false`) when the query returns no fixable alerts.
- Document `bump-command` recipes for npm/pnpm, cargo, and pip/uv in the
  README.
- Existing callers that pass no new inputs keep the current behavior. This is
  a minor version bump on `v1`; no **BREAKING** changes.

## Capabilities

### New Capabilities

- `reusable-dependabump`: The reusable workflow that reads open Dependabot
  alerts for selected ecosystems, applies dependency bumps (built-in Go or a
  caller-supplied command), runs an optional post-bump command, opens a PR, and
  sends Slack notifications.

### Modified Capabilities

None. No specs exist yet under `openspec/specs/`.

## Impact

- `workflows/reusable-dependabump/reusable-dependabump.yml` (source) and its
  synced copy `.github/workflows/reusable-dependabump.yml`.
- `workflows/reusable-dependabump/README.md`: new inputs, alerts file format,
  per-ecosystem recipes.
- New `.changeset/*.md` entry (minor) for `reusable-dependabump`.
- Callers: no change needed. Non-Go repos can adopt it by setting `ecosystem`
  and `bump-command`.
