# Reusable PR Triage

Runs [`pr-triage`](https://github.com/smartcontractkit/pr-triage) on the pull
request that triggered the workflow. It wraps the
[`pr-triage` action](https://github.com/smartcontractkit/.github/tree/main/actions/pr-triage)
with:

- a full-history, credential-free checkout;
- the minimal permissions the analysis needs;
- GATI v2 token minting for the private release download and organization
  membership reads;
- fork pull request handling that skips instead of failing.

`pr-triage` writes the step outputs and the job summary itself.

## Usage

```yaml
name: PR triage

on:
  pull_request:

permissions: {}

jobs:
  triage:
    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-pr-triage.yml@reusable-pr-triage/v0
    secrets:
      PR_TRIAGE_AI_API_KEY: ${{ secrets.PR_TRIAGE_AI_API_KEY }}
    with:
      release-token-profile: pr-triage-release-read
      org-token-profile: org-members-read
```

The calling job must grant every permission the workflow declares, including
`id-token: write` for GATI v2, even when neither profile is set. A reusable
workflow cannot request more than its caller grants.

## Inputs

| Input                    | Type    | Default | Description                                                                                         |
| ------------------------ | ------- | ------- | --------------------------------------------------------------------------------------------------- |
| `release-token-profile`  | string  | `""`    | GATI v2 profile with `contents: read` on `smartcontractkit/pr-triage`. Empty downloads from public. |
| `org-token-profile`      | string  | `""`    | GATI v2 profile with organization `members: read`. Empty keeps lookups on the workflow token.       |
| `dry-run`                | boolean | `false` | Read GitHub, write nothing.                                                                         |
| `skip-reviewer-requests` | boolean | `false` | Write labels and the report comment, but do not request reviewers.                                  |
| `verbose`                | boolean | `false` | Print the full Markdown report.                                                                     |
| `no-ai`                  | boolean | `false` | Skip the optional AI semantic request.                                                              |
| `ai-base-url`            | string  | `""`    | Provider endpoint for AI semantic signals. Empty uses the CLI default.                              |
| `log-level`              | string  | `""`    | Diagnostic log level (`debug`, `info`, `warn`, `error`, `disabled`).                                |

## Secrets

| Secret                 | Required | Description                                            |
| ---------------------- | -------- | ------------------------------------------------------ |
| `PR_TRIAGE_AI_API_KEY` | no       | Provider API key for the optional AI semantic signals. |

## Outputs

| Output             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `risk-level`       | Risk level assigned to the pull request.             |
| `complexity-level` | Complexity level assigned to the pull request.       |
| `approvals`        | Number of approvals the analysis recommends.         |
| `reviewers`        | Reviewer logins the analysis recommends or requests. |
| `dependency-bump`  | `true` when the pull request is a dependency bump.   |
| `report-path`      | Path to the Markdown report the analysis wrote.      |

## Tokens

Pull request reads and writes use the calling repository's `GITHUB_TOKEN`. The
two minted tokens are scoped to the job and revoked when it ends.

- `release-token-profile` only downloads the `pr-triage` binary. While
  `smartcontractkit/pr-triage` is private it needs `contents: read` there; once
  the repository is public, clear the input and the step is skipped.
- `org-token-profile` only answers organization membership lookups
  (`GET /orgs/{org}/members`), so membership stays readable with a repo-scoped
  pull request token. Without it, reviewer suggestions include people outside
  the organization.

## Fork pull requests

Fork pull requests cannot mint GATI v2 tokens.

- While `release-token-profile` is set, a fork pull request skips the analysis
  and the workflow posts a notice explaining why. It does not fail the job.
- Once `release-token-profile` is empty, fork pull requests run the analysis
  with the read-only workflow token. They skip org-token minting and allow
  reviewers outside the organization.

## Requirements

- A `pull_request` event. Fork detection reads
  `github.event.pull_request.head.repo.full_name`.
- A Linux runner. The action supports Linux `amd64` and `arm64` only.
- `fetch-depth: 0` comes from the workflow; callers do not check out first.
- The `pr-triage/v0` action tag exists after the action's first release. Until
  then, the analysis step fails to resolve.
