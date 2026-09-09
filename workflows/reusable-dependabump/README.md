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
    uses: smartcontractkit/.github/.github/workflows/reusable-dependabump.yml@reusable-dependabump/v1
    secrets:
      SLACK_TOKEN: ${{ secrets.DEPENDABUMP_SLACK_TOKEN }}
      SLACK_CHANNEL_ID: ${{ secrets.DEPENDABUMP_SLACK_CHANNEL_ID }}
```
