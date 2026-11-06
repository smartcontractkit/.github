# Reusable CRE Audit Consumer

Repo-side jobs for **cre-audit**, the optional AI security/correctness audit for CRE
capabilities. The audit engine, per-capability packs (rubrics), and findings live in
`smartcontractkit/cre-docs` under `.agents/skills/cre-audit`. This workflow only handles the
consumer repo's side: PR comments, the `/audit` command, and the `audit/<capability>` status.

| Event                 | Job       | What it does                                                                 |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| `pull_request_target` | `suggest` | One comment per touched pack suggesting `/audit <capability>`                |
| `issue_comment`       | `command` | Parses `/audit`, checks write access and signed commits, dispatches cre-docs |
| `workflow_dispatch`   | `status`  | cre-docs reports back; stamps `audit/<capability>` on the audited commit     |

The `audit/<capability>` status is **advisory**. Do not make it a required check or a
merge-queue requirement: runs are started by hand, take up to an hour, and do not run on
`merge_group` commits.

## Usage

Add `.github/workflows/cre-audit.yml` to the consumer repo:

```yaml
name: CRE Audit

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]
  workflow_dispatch:
    # Invoked by cre-docs to stamp audit/<capability>.
    inputs:
      capability: { type: string, required: true }
      pr_number: { type: string, required: true }
      head_sha: { type: string, required: true }
      state: { type: string, required: true }
      description: { type: string, required: true }
      target_url: { type: string, required: false }

permissions: {}

jobs:
  audit:
    if: >-
      github.event_name != 'issue_comment' ||
      (github.event.issue.pull_request != null && startsWith(github.event.comment.body, '/audit'))
    uses: smartcontractkit/.github/.github/workflows/reusable-cre-audit-consumer.yml@reusable-cre-audit-consumer/v1
    permissions:
      contents: read
      id-token: write
      issues: write
      pull-requests: write
      statuses: write
    with:
      packs: |
        http_trigger=^http_trigger/
    secrets:
      GATI_AWS_ROLE_ARN: ${{ secrets.<GATI role that can dispatch workflows in cre-docs> }}
      GATI_AWS_LAMBDA_URL: ${{ secrets.<GATI lambda url> }}
```

## Inputs

| Input     | Required | Description                                                                                                                               |
|-----------|----------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `packs`   | yes      | One `<capability>=<regex over changed file paths>` per line. Lines starting with `#` are ignored. The name must match a pack in cre-docs. |
| `aliases` | no       | `<old-command>=<capability>` per line, e.g. `vault-audit=vault` makes `/vault-audit` mean `/audit vault`.                                 |

## Secrets

| Secret                | Description                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `GATI_AWS_ROLE_ARN`   | GATI role whose token can run `audit-dispatch.yml` in `smartcontractkit/cre-docs` |
| `GATI_AWS_LAMBDA_URL` | GATI lambda URL                                                                   |

The cre-docs GATI role must also be allowed to run `cre-audit.yml` in the consumer repo, which
is how results are reported back.

## Commands

```
/audit                         audit every pack whose paths the PR touches
/audit <pack>                  audit one pack
/audit [<pack>] skip <reason>  record a skip (write access required)
model=opus|sonnet|haiku effort=low|medium|high|xhigh|max   optional overrides
```
