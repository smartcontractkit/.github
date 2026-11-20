# pr-triage

Runs [`pr-triage`](https://github.com/smartcontractkit/pr-triage) on the pull
request that triggered the workflow. The action downloads the latest Linux
release archive, verifies its SHA-256 against the release's `checksums.txt`, and
executes `pr-triage analyze`. The CLI writes the step outputs and the job
summary itself. Pass `version` to pin a specific release instead of tracking the
latest one.

## Usage

```yaml
name: PR triage

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          persist-credentials: false
      - id: triage
        uses: smartcontractkit/.github/actions/pr-triage@pr-triage/v0
        with:
          release-token: ${{ secrets.PR_TRIAGE_RELEASE_READ_TOKEN }}
          org-token: ${{ secrets.PR_TRIAGE_ORG_READ_TOKEN }}
      - run: echo "risk is ${{ steps.triage.outputs.risk-level }}"
```

`fetch-depth: 0` is required: the CLI resolves merge bases and reads a 90-day
file-hotness window.

## Inputs

| Input                     | Default               | Description                                                                                 |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `version`                 | latest release        | `pr-triage` release tag (`vX.Y.Z`) to install. Pin this to avoid upgrades.                  |
| `github-token`            | `${{ github.token }}` | Token for every pull request read and write.                                                |
| `release-token`           | `""`                  | Token with `contents: read` on `smartcontractkit/pr-triage`, for private release downloads. |
| `org-token`               | `""`                  | Token with organization `members: read`, forwarded as `PR_TRIAGE_ORG_TOKEN`.                |
| `dry-run`                 | `"false"`             | Read GitHub, write nothing.                                                                 |
| `skip-reviewer-requests`  | `"false"`             | Write labels and the comment, but do not request reviewers.                                 |
| `allow-non-org-reviewers` | `"false"`             | Suggest reviewers outside the repository owner's organization.                              |
| `verbose`                 | `"false"`             | Print the full Markdown report.                                                             |
| `no-ai`                   | `"false"`             | Skip the optional AI semantic request.                                                      |
| `ai-api-key`              | `""`                  | Provider key for AI semantic signals, forwarded as `PR_TRIAGE_AI_API_KEY`.                  |
| `ai-base-url`             | `""`                  | Provider endpoint for AI semantic signals, forwarded as `PR_TRIAGE_AI_BASE_URL`.            |
| `log-level`               | `""`                  | Diagnostic log level (`debug`, `info`, `warn`, `error`, `disabled`).                        |

## Outputs

| Output             | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `risk-level`       | Risk level assigned to the pull request.             |
| `complexity-level` | Complexity level assigned to the pull request.       |
| `approvals`        | Number of approvals the analysis recommends.         |
| `reviewers`        | Reviewer logins the analysis recommends or requests. |
| `dependency-bump`  | `true` when the pull request is a dependency bump.   |
| `report-path`      | Path to the Markdown report the CLI wrote.           |

## Tokens

- `github-token` carries every pull request read and write. The calling job
  needs `contents: read`, `pull-requests: write`, and `issues: write`.
- `release-token` only downloads the action itself. While
  `smartcontractkit/pr-triage` is private, it needs `contents: read` there; once
  the repository is public, drop the input. It is never passed to the CLI's
  child process.
- `org-token` only answers organization membership lookups
  (`GET /orgs/{org}/members`), so membership stays readable when the pull
  request token is repo-scoped. Without it, pass
  `allow-non-org-reviewers: true`.

All token inputs are masked in the log.

## Platforms

Linux `X64` and `ARM64` runners only. Other platforms fail before download.
