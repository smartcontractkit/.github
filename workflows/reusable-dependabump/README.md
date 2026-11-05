# Dependabump

This workflow inspects dependenabot vulnerabilities, and opens pull requests to
update dependencies.

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
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-dependabump.yml@reusable-dependabump/v2
    secrets:
      SLACK_TOKEN: ${{ secrets.DEPENDABUMP_SLACK_TOKEN }}
      SLACK_CHANNEL_ID: ${{ secrets.DEPENDABUMP_SLACK_CHANNEL_ID }}
```

## Private Go modules

If your modules depend on private repositories, set `gati-profile` to a GATI v2
profile with `contents: read` on them. git then uses its token for
`https://github.com/`.

```yaml
with:
  gati-profile: <your-profile>
  goprivate: github.com/smartcontractkit/<private-repo>
```

`goprivate` is optional. It is exported as `GOPRIVATE`, so matching modules skip
the public proxy and checksum database. Set it if a bump adds a private module
version that isn't already in `go.sum`, which would otherwise fail checksum
verification.

The job always requests `id-token: write`, so callers must grant it even without
`gati-profile`.
