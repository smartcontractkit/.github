# bump-mcms-tools

Reusable composite action to automatically detect the latest release of
[`mcms-tools`](https://github.com/smartcontractkit/mcms-tools)  
and update all workflows that reference the `get-mcms-tools` composite action.

Use this to keep CI pipelines in sync with the latest released binary version of
`mcms-tools`,  
preventing stale or manual version bumps.

---

### Prerequisites

**NOTE**: _Requires the [GitHub CLI](https://cli.github.com/) and
[`yq`](https://github.com/mikefarah/yq) (installed automatically)._

This action uses the GitHub API to fetch the latest tag of `mcms-tools`, so it
requires a token with  
`contents: read` permission. It will output a flag indicating if any workflows
were modified.

---

### Inputs

| Name                  | Required | Default                                            | Description                                                                 |
| --------------------- | -------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `github_token`        | ✅       | —                                                  | GitHub token for API authentication (`secrets.GITHUB_TOKEN` is sufficient). |
| `mcms_repo`           | ❌       | `smartcontractkit/mcms-tools`                      | Repository to fetch the latest release tag from.                            |
| `workflows_regex`     | ❌       | `^\.github/workflows/.*\.(yml\|yaml)$`             | Regex pattern to match workflow files to update.                            |
| `action_uses_pattern` | ❌       | `smartcontractkit/.github/actions/get-mcms-tools@` | Prefix to identify the `uses:` line for the downloader action.              |
| `version_input_path`  | ❌       | `with.version`                                     | YAML path to the input key to update (relative to the step).                |

---

### Outputs

| Name         | Description                                                                  |
| ------------ | ---------------------------------------------------------------------------- |
| `latest_tag` | The latest tag fetched from the `mcms-tools` repository.                     |
| `changed`    | Boolean (`true`/`false`) indicating whether any workflow files were updated. |

---

```yaml
name: Bump mcms-tools
on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Bump mcms-tools
        id: bump
        uses: smartcontractkit/.github/actions/bump-mcms-tools@<sha> # bump-mcms-tools@x.y.z
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          mcms_repo: smartcontractkit/mcms-tools
          workflows_regex: "^\\.github/workflows/.*\\.(yml|yaml)$"
          action_uses_pattern: "smartcontractkit/.github/actions/get-mcms-tools@"
          version_input_path: "with.version"

      - name: Create PR
        if: steps.bump.outputs.changed == 'true'
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/bump-mcms-tools-${{ steps.bump.outputs.latest_tag }}
          commit-message:
            "chore: bump mcms-tools to ${{ steps.bump.outputs.latest_tag }}"
          title:
            "chore: bump mcms-tools to ${{ steps.bump.outputs.latest_tag }}"
          body: |
            Automated bump of `with.version` to **${{ steps.bump.outputs.latest_tag }}**.
            Source: `smartcontractkit/mcms-tools` latest release.
          labels: dependencies, automation
```
