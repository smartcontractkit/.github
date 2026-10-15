# Design

## Context

The workflow is a single job (`workflows/reusable-dependabump/reusable-dependabump.yml`,
synced to `.github/workflows/` by `tools/scripts/sync-reusable-workflows.sh`).
Its Go path today:

1. `actions/setup-go` + `GOTOOLCHAIN=auto`.
2. `go install` of `jmank88/gomods` and `chainlink-common/script/cmd/dependabot`
   (step `install`, `continue-on-error`).
3. Step `bump`: validates `severity`, queries
   `/dependabot/alerts?state=open&ecosystem=Go&severity=…`, pipes
   `./<dir> <package> <patched>` lines into `dependabot`, runs `gomods tidy`,
   sets `changed`.
4. Optional Nix install + `post-bump-command`, Slack failure gate,
   `peter-evans/create-pull-request`, Slack PR notifications.

Every failure-prone step uses `continue-on-error` and a shared
"Notify Failure" / "Exit on Failure" gate keyed on step outcomes. New steps
must join that gate.

## Goals / Non-Goals

**Goals:**

- One query/validation path shared by all ecosystems; ecosystem-specific work
  lives only in the bump step.
- Zero changes required from existing Go callers.

**Non-Goals:**

- Built-in bump logic for npm/pnpm, cargo, or pip/uv. These are covered by
  README recipes passed as `bump-command`.
- A configurable PR branch, title, or body. Callers that need two separate
  PRs per repo are out of scope.
- Toolchain setup inputs (setup-node, setup-python, etc.). `ubuntu-latest`
  ships Node + corepack, Rust/cargo, and Python/pip; anything else can be
  installed inside `bump-command`.

## Decisions

### D1: Split into `validate` → `alerts` → `bump-go` | `bump-custom` steps

- `validate`: checks `severity` (existing regex), `ecosystem` (allow-list
  regex of API values), and "non-Go without `bump-command`". Normalizes both
  lists (strip whitespace, lowercase ecosystem) into step outputs. Runs first
  so bad input fails before any API call or tool install.
- `alerts`: one `gh api --paginate` call with `ecosystem=<list>` and
  `severity=<list>`, filtered to `first_patched_version != null`, and reshaped
  by `jq` into the documented array. Written to
  `$RUNNER_TEMP/dependabump-alerts.json`. Outputs `count` and `file`.
  `--paginate` emits one array per page, so the result is merged with
  `jq -s 'add // []'`.
- `bump-go`: runs when `count > 0` and `bump-command` is empty. Setup Go,
  `GOTOOLCHAIN=auto`, and tool install move behind the same condition. It
  builds the existing `./<dir> <pkg> <ver>` lines from the alerts file
  (`manifest_path | rtrimstr("go.mod")`), pipes to `dependabot`, then
  `gomods tidy`.
- `bump-custom`: runs when `count > 0` and `bump-command` is set. Runs
  `eval "$BUMP_COMMAND"` with `DEPENDABUMP_ALERTS_FILE` exported, matching how
  `post-bump-command` is run today.
- A final `changed` check (`git status --porcelain`) runs after whichever bump
  ran and writes `changed` with `| tee -a "$GITHUB_OUTPUT"`. Downstream
  conditions switch from `steps.bump.outputs.changed` to this step.

Alternative: keep one `bump` step with a `case` on ecosystem. Rejected: Go
setup and tool install would still need separate conditional steps, and the
single step would hide which phase failed in Slack/UI.

### D2: Alerts as a JSON file, not stdin or env

A file path in `DEPENDABUMP_ALERTS_FILE` works for any command (`jq`, a
Node/Python script, a Makefile target), has no size limit, and can be read
more than once. Fields use snake_case and stable names
(`ecosystem`, `manifest_path`, `package`, `patched_version`,
`vulnerable_version_range`, `severity`, `ghsa_id`) so they are independent of
the API response shape.

### D3: `bump-command` replaces the built-in Go bump

If `bump-command` is set, the built-in Go bump never runs, even when `go` is
in `ecosystem`. Mixed repos write one command that handles every ecosystem in
the file. Alternative (run both): rejected because ordering and partial
failure become ambiguous, and Go setup would be needed even for callers that
manage Go themselves.

### D4: Skip all bump work when no fixable alerts exist

Today the Go path runs `gomods tidy` even with zero alerts, which can open a
"dependabump" PR that fixes no vulnerability. With `count == 0` the bump,
post-bump, and PR steps are all skipped. This is a small behavior change for
Go callers, but it matches the workflow's purpose and the 1.0.4 intent
(no PR with nothing to fix).

### D5: Ecosystem allow-list mirrors the API

Allow-list: `composer|go|maven|npm|nuget|pip|pub|rubygems|rust|swift`.
Strict validation catches common mistakes early (`cargo` vs `rust`,
`pnpm`/`yarn` vs `npm`, `uv`/`python` vs `pip`); the README maps tools to
API values.

### D6: Versioning

Minor changeset for `reusable-dependabump` (1.0.4 → 1.1.0). The `v1` tag
keeps working for existing callers.

## Risks / Trade-offs

- [D4 changes Go behavior: repos that relied on the daily run for `gomods
  tidy` stop getting tidy-only PRs] → Call it out in the changeset; that
  outcome was never the workflow's purpose.
- [`eval` of caller input] → Same trust model as the existing
  `post-bump-command`: the input comes from the caller's own workflow file,
  passed through `env`, never interpolated into the script.
- [README recipes drift from real tool behavior, e.g. transitive npm deps need
  `pnpm.overrides` rather than `pnpm update`] → Recipes are documented as
  starting points; each one updates the lockfile and is checked by the
  caller's CI on the PR.
- [Dependabot `manifest_path` for some ecosystems points at a lockfile, not
  a manifest] → Pass it through unchanged; recipes use `dirname` of the path.

## Migration Plan

No caller action. Non-Go repos opt in with `ecosystem` + `bump-command`.
Rollback: callers pin `reusable-dependabump/v1.0.4`.
