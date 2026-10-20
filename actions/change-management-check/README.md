# change-management-check

> Fails the check when a change-management section in the PR body is empty or
> missing

Fails when a section required by the
[Infrastructure Change Management Standard](https://smartcontract-it.atlassian.net/wiki/spaces/ENG/pages/1417445401/Infrastructure+Change+Management+Standard)
is empty or missing. The failure message names the empty sections.

## Usage

Call the action from a `pull_request_target` workflow, then add the job name
(`change-management-sections`) as a required status check. The job needs the
`pull-requests: read` permission.

```yaml
name: Change management check
on:
  pull_request_target:
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  pull-requests: read

jobs:
  change-management-sections:
    runs-on: ubuntu-latest
    steps:
      - uses: smartcontractkit/.github/actions/change-management-check@change-management-check/v1
        with:
          sections: |
            Testing evidence: testing evidence
            Success / failure criteria: success / failure criteria
            Rollback plan: rollback plan
```

## Inputs

| Input           | Default      | Description                                                                                                                        |
| --------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `sections`      | required     | Lines of `Display name: heading text`, one per required section. The heading text matches case-insensitively at any heading level. |
| `strip-lines`   | `""`         | Lines removed from a section before the empty test. Use for template default lines.                                                |
| `docs-paths`    | `**/*.md`    | Glob lines. A PR whose files all match is exempt (docs-only). An empty value disables the exemption.                               |
| `dev-paths`     | `""`         | Glob lines. A PR whose files all match is exempt (dev-only).                                                                       |
| `head-prefixes` | `renovate/`  | Comma-separated head-branch prefixes that are exempt. An empty value disables the exemption.                                       |
| `standard-url`  | the Standard | Link included in the failure message.                                                                                              |

## Exemptions

A pull request is skipped when its head branch starts with an exempt prefix, or
when every changed file matches a docs or dev glob. Content inside HTML comments
does not count.

## Limitations

- An unbalanced code fence hides later sections, the same way GitHub renders the
  body.
- The files API returns at most 3000 files; exemptions classify on those.
- Heading text matches exactly, so a renamed heading reads as missing.
