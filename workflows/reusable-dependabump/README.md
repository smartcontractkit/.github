# Dependabump

This workflow inspects dependenabot vulnerabilities, and opens pull requests to
update dependencies.

Go is supported out of the box. Other ecosystems are supported by passing a
`bump-command` that applies the fixes (see [recipes](#bump-command-recipes)).

## Recommended usage

Example workflow:

```yaml
name: dependabump

on:
  workflow_dispatch:
  schedule:
    - cron: "0 0 * * 1-5" # every week-day at midnight

permissions: {}

jobs:
  dependabump:
    permissions:
      contents: write
      pull-requests: write
      actions: read
      security-events: read
      vulnerability-alerts: read
    uses: smartcontractkit/.github/.github/workflows/reusable-dependabump.yml@reusable-dependabump/v1
    secrets:
      SLACK_TOKEN: ${{ secrets.DEPENDABUMP_SLACK_TOKEN }}
      SLACK_CHANNEL_ID: ${{ secrets.DEPENDABUMP_SLACK_CHANNEL_ID }}
```

## Inputs

| Input               | Default                  | Description                                                                                                                         |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `severity`          | `critical,high,moderate` | Comma-separated alert severities to fix: `critical`, `high`, `moderate`, `low`.                                                     |
| `ecosystem`         | `go`                     | Comma-separated Dependabot ecosystems to query (see [mapping](#ecosystem-values)).                                                  |
| `bump-command`      |                          | Command that applies the fixes. Replaces the built-in Go bump. Required when `ecosystem` contains anything other than `go`.         |
| `post-bump-command` |                          | Command to run after a bump that changed files, e.g. to add a changeset. Nix is installed first when the command contains `nix`.   |

When no open alert with a patched version matches `ecosystem` and `severity`,
the workflow makes no changes and opens no pull request.

### Ecosystem values

`ecosystem` uses the Dependabot alerts API values, not tool names:

| Tool                 | `ecosystem` |
| -------------------- | ----------- |
| Go modules           | `go`        |
| npm, pnpm, yarn      | `npm`       |
| cargo                | `rust`      |
| pip, uv, poetry      | `pip`       |
| Composer             | `composer`  |
| Maven, Gradle        | `maven`     |
| NuGet                | `nuget`     |
| pub (Dart/Flutter)   | `pub`       |
| Bundler              | `rubygems`  |
| Swift Package Manager | `swift`    |

## Alerts file

Before `bump-command` runs, the workflow writes the matching alerts to a JSON
file and sets `DEPENDABUMP_ALERTS_FILE` to its path. Only open alerts with a
patched version are included. The command runs from the repository root.

```json
[
  {
    "ecosystem": "npm",
    "manifest_path": "web/pnpm-lock.yaml",
    "package": "esbuild",
    "patched_version": "0.25.0",
    "vulnerable_version_range": "<= 0.24.2",
    "severity": "medium",
    "ghsa_id": "GHSA-67mh-4wv8-2f99"
  }
]
```

`severity` is the advisory severity as returned by GitHub, so a `moderate`
alert shows up as `medium`. `manifest_path` can point at a manifest or a
lockfile; the recipes below use its directory.

## `bump-command` recipes

These are starting points. Check the resulting pull request in CI as usual.
`ubuntu-latest` ships Node with corepack, cargo, and Python; install anything
else (e.g. `uv`) inside the command.

### pnpm

Adds a `pnpm.overrides` entry to the root `package.json` for each alert,
scoped to the vulnerable range, then refreshes the lockfile. This also fixes
transitive dependencies.

```yaml
    with:
      ecosystem: npm
      bump-command: |
        corepack enable
        jq --slurpfile alerts "$DEPENDABUMP_ALERTS_FILE" '.pnpm.overrides += ($alerts[0] | map({
            key: "\(.package)@\(.vulnerable_version_range | gsub(" "; "") | gsub(","; " "))",
            value: ">=\(.patched_version)"
          }) | from_entries)' package.json > package.json.tmp
        mv package.json.tmp package.json
        pnpm install --no-frozen-lockfile
```

For npm repos, `npm audit fix --package-lock-only` is a simpler alternative; it
uses the npm advisory database rather than the alerts file.

### cargo

Updates each vulnerable crate in its workspace's lockfile to the patched
version. Fails when `Cargo.toml` does not allow the patched version; that
needs a manual bump.

```yaml
    with:
      ecosystem: rust
      bump-command: |
        jq -r '.[] | "\(.manifest_path) \(.package) \(.patched_version)"' "$DEPENDABUMP_ALERTS_FILE" | sort -u |
          while read -r manifest package version; do
            (cd "$(dirname "$manifest")" && cargo update -p "$package" --precise "$version")
          done
```

### pip / uv

Upgrades each vulnerable package in the `uv.lock` next to its manifest.

```yaml
    with:
      ecosystem: pip
      bump-command: |
        pip install uv
        jq -r '.[] | "\(.manifest_path) \(.package) \(.patched_version)"' "$DEPENDABUMP_ALERTS_FILE" | sort -u |
          while read -r manifest package version; do
            (cd "$(dirname "$manifest")" && uv lock --upgrade-package "${package}==${version}")
          done
```
