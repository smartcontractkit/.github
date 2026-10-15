# Spec Delta

## Purpose

The reusable dependabump workflow turns open, fixable Dependabot alerts in a
calling repository into a dependency-bump pull request, for any supported
package ecosystem, and reports the result to Slack.

## ADDED Requirements

### Requirement: Ecosystem selection

The workflow SHALL accept an optional `ecosystem` input: a comma-separated list
of Dependabot alert ecosystems. The default SHALL be `go`. Whitespace around
entries SHALL be ignored and matching SHALL be case-insensitive.

#### Scenario: Default ecosystem

- **WHEN** a caller does not set `ecosystem`
- **THEN** the workflow queries only Dependabot alerts in the `go` ecosystem

#### Scenario: Multiple ecosystems

- **WHEN** a caller sets `ecosystem: "npm, rust"`
- **THEN** the workflow queries Dependabot alerts in both the `npm` and `rust`
  ecosystems

### Requirement: Ecosystem validation

The workflow SHALL reject any `ecosystem` entry that is not an ecosystem value
of the GitHub Dependabot alerts API (`composer`, `go`, `maven`, `npm`, `nuget`,
`pip`, `pub`, `rubygems`, `rust`, `swift`). A rejected input SHALL fail the run
and send the failure Slack notification.

#### Scenario: Unknown ecosystem

- **WHEN** a caller sets `ecosystem: "cargo"`
- **THEN** the run fails with an error that names the invalid value
- **AND** the failure Slack notification is sent

### Requirement: Severity filter

The workflow SHALL keep its `severity` input (default `critical,high,moderate`)
and its validation. Only alerts with a listed severity SHALL be returned.

#### Scenario: Severity applies to all ecosystems

- **WHEN** a caller sets `ecosystem: "npm"` and `severity: "critical"`
- **THEN** only open `npm` alerts with severity `critical` are returned

### Requirement: Fixable alerts only

The workflow SHALL consider only open alerts that have a first patched version.
When no such alert exists, the workflow SHALL make no changes, SHALL NOT run a
bump command or `post-bump-command`, and SHALL NOT open a pull request.

#### Scenario: No fixable alerts

- **WHEN** every matching open alert has no first patched version
- **THEN** the run succeeds with no file changes and no pull request

### Requirement: Alerts file

Before the bump runs, the workflow SHALL write the fixable alerts to a JSON
file and SHALL set `DEPENDABUMP_ALERTS_FILE` to its path for the bump command.
The file SHALL be a JSON array. Each element SHALL contain `ecosystem`,
`manifest_path`, `package`, `patched_version`, `vulnerable_version_range`,
`severity`, and `ghsa_id`.

#### Scenario: Alerts file contents

- **WHEN** one open `npm` alert exists for `lodash` in `web/package.json`,
  patched in `4.17.21`
- **THEN** the alerts file has one element with `ecosystem` `npm`,
  `manifest_path` `web/package.json`, `package` `lodash`, and
  `patched_version` `4.17.21`

### Requirement: Caller-supplied bump command

The workflow SHALL accept an optional `bump-command` input. When it is set, the
workflow SHALL run it from the repository root in place of the built-in Go
bump, with `DEPENDABUMP_ALERTS_FILE` set. A non-zero exit SHALL fail the run
and send the failure Slack notification.

#### Scenario: Custom bump for cargo

- **WHEN** a caller sets `ecosystem: "rust"` and a `bump-command`
- **AND** fixable `rust` alerts exist
- **THEN** the workflow runs the `bump-command` and does not run the built-in
  Go bump

#### Scenario: Custom bump command fails

- **WHEN** the `bump-command` exits non-zero
- **THEN** the run fails, the failure Slack notification is sent, and no pull
  request is opened

### Requirement: Built-in Go bump

When `bump-command` is empty and `ecosystem` is only `go`, the workflow SHALL
set up Go with automatic toolchain selection, install its Go bump tools, apply
the patched versions to the matching `go.mod` files, and tidy all modules.
Go SHALL NOT be set up when the built-in Go bump does not run.

#### Scenario: Existing Go caller

- **WHEN** a caller sets neither `ecosystem` nor `bump-command`
- **AND** fixable `go` alerts exist
- **THEN** the workflow applies the patched versions to the matching `go.mod`
  files and tidies all modules, as in version 1.0.4

#### Scenario: Non-Go ecosystem skips Go setup

- **WHEN** a caller sets `ecosystem: "npm"` and a `bump-command`
- **THEN** the workflow does not set up Go or install the Go bump tools

### Requirement: Bump command required for non-Go ecosystems

When `bump-command` is empty and `ecosystem` contains any value other than
`go`, the workflow SHALL fail before it queries alerts and SHALL send the
failure Slack notification.

#### Scenario: npm without a bump command

- **WHEN** a caller sets `ecosystem: "npm"` and no `bump-command`
- **THEN** the run fails with an error that says `bump-command` is required
  for non-Go ecosystems

### Requirement: Post-bump command

The workflow SHALL run `post-bump-command`, when set, only after a bump that
changed files. When `post-bump-command` contains `nix`, Nix SHALL be installed
first. A non-zero exit SHALL fail the run and send the failure Slack
notification.

#### Scenario: Post-bump after a change

- **WHEN** the bump changes files and `post-bump-command` is set
- **THEN** the workflow runs `post-bump-command` before it opens the pull
  request

#### Scenario: Post-bump skipped without a change

- **WHEN** the bump changes no files
- **THEN** the workflow does not run `post-bump-command`

### Requirement: Pull request and notifications

When the bump changes files, the workflow SHALL open or update a signed pull
request from branch `bot/dependabump` and SHALL send a Slack message with its
URL. When the pull request cannot be created, the workflow SHALL fail and send
a Slack message that says so.

#### Scenario: PR opened

- **WHEN** the bump changes files and pull request creation succeeds
- **THEN** a Slack message with the pull request URL is sent to
  `SLACK_CHANNEL_ID`

#### Scenario: PR creation fails

- **WHEN** the bump changes files and pull request creation fails
- **THEN** the run fails and a Slack message that reports the failure is sent
