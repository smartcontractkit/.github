# change-management-check

> Fails the check when a change-management section in the PR body is empty or
> missing

Fails when a section required by the
[Infrastructure Change Management Standard](https://smartcontract-it.atlassian.net/wiki/spaces/ENG/pages/1417445401/Infrastructure+Change+Management+Standard)
is empty or missing. The failure message names the empty sections. The action
reads only the pull request body from the event payload.

## Usage

Call the action from a `pull_request_target` workflow, then add the job name
(`change-management-sections`) as a required status check. The workflow decides
whether the check applies: skip it for exempt head branches and when every
changed file is a docs or dev path, using
[dorny/paths-filter](https://github.com/dorny/paths-filter). The job needs the
`pull-requests: read` permission for the path filter. The `timeout-minutes`
setting turns a hung run into a fast failure; `concurrency` cancels stale runs
when the body changes.

```yaml
name: Change management check
on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  pull-requests: read

concurrency:
  group: change-management-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  change-management-sections:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Filter changed paths
        id: filter
        if: ${{ !startsWith(github.head_ref, 'renovate/') }}
        uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4
        with:
          # The negation rules apply only with some-with-excludes.
          predicate-quantifier: some-with-excludes
          filters: |
            check:
              - '**'
              - '!**/*.md'
              - '!projects/ingest-hub-preview/**' # dev paths, per repo
      - name: Check change management sections
        if: ${{ steps.filter.outputs.check == 'true' }}
        uses: smartcontractkit/.github/actions/change-management-check@change-management-check/v1
        with:
          sections: |
            Testing evidence: testing evidence
            Success / failure criteria: success / failure criteria
            Rollback plan: rollback plan
```

## Inputs

| Input          | Default      | Description                                                                                                                        |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `sections`     | required     | Lines of `Display name: heading text`, one per required section. The heading text matches case-insensitively at any heading level. |
| `strip-lines`  | `""`         | Lines removed from a section before the empty test. Use for template default lines.                                                |
| `standard-url` | the Standard | Link included in the failure message.                                                                                              |

## Exemptions

The workflow decides whether the check applies, not the action. Skip the check
step (or job) for exempt pull requests, for example `renovate/` head branches,
docs-only changes, or dev-only changes. Use a condition on the step or job: a
workflow skipped by path filtering leaves its check pending, which blocks a
required check.

## Limitations

- An unbalanced code fence hides later sections, the same way GitHub renders the
  body.
- Heading text matches exactly, so a renamed heading reads as missing.
