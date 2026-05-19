# cicd-changesets-check

Comments on PRs with whether a PR has a changeset or not and links to
documentation explaining to contributors how to create a changeset.

Based on [changesets/check-action](https://github.com/changesets/check-action)
(MIT, © changesets contributors).

## Usage

```yaml
name: Changeset Check

on: pull_request

jobs:
  check:
    name: Changeset Check
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - name: Check for changeset
        uses: smartcontractkit/.github/actions/cicd-changesets-check@<version>
        with:
          token: ${{ github.token }}
```

## Inputs

| Name              | Description                                | Required | Default               |
| ----------------- | ------------------------------------------ | -------- | --------------------- |
| `token`           | GitHub token for API access                | Yes      | `${{ github.token }}` |
| `fail-on-missing` | Fail the workflow if no changeset is found | No       | `"true"`              |

## Outputs

| Name            | Description                                 |
| --------------- | ------------------------------------------- |
| `has-changeset` | Whether the PR has a changeset (true/false) |

## Development

1. Update dist: `pnpm nx run cicd-changesets-check:build`
2. Run tests: `pnpm nx run cicd-changesets-check:test`
