# codeowners-sanity-check

An action performing a sanity check on the presence and contents of a repo's
CODEOWNERS file.

## Behaviour

1. Queries the
   [codeowners errors](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-codeowners-errors)
   Github API endpoint for the current PR branch
2. If the CODEOWNERS file doesn't exist (404) - leave a comment on the PR
3. If the CODEOWNERS file has errors - leave comment on the PR, annotate file
4. If the CODEOWNERS exists and is valid, update comment from above (if exists)

## Usage

1. Only operates on `pull_request` events
2. Requires `contents: read`, `actions: read`, `pull_requests: write`
   permissions

### Inputs

| Input     | Description                                                                    | Required | Default |
| --------- | ------------------------------------------------------------------------------ | -------- | ------- |
| `enforce` | Whether to fail the action on the presence and validity of the CODEOWNERS file | No       | `true`  |

### Workflow

```
name: "CodeOwners Enforcement"

on:
  pull_request:

jobs:
  enforce-codeowners:
    name: "Enforce"
    runs-on: ubuntu-latest
    permissions:
      contents: read
      actions: read
      pull-requests: write
    steps:
      - name: CODEOWNERS Sanity Check
        uses: smartcontractkit/.github/actions/codeowners-sanity-check@<tag>
        env:
          GITHUB_TOKEN: ${{ github.token }}
```

## Development

1. Update dist: `pnpm nx run build  codeowners-sanity-check`
2. Run tests: `pnpm nx run test codeowners-sanity-check`
3. Record Fixtures (new only):
   `NOCK_BACK_MODE=record pnpm nx test codeowners-sanity-check`
4. Update Fixtures (existing only):
   `NOCK_BACK_MODE=update pnpm nx test codeowners-sanity-check`
