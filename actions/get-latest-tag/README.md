# get-latest-tag

A GitHub Action that finds the latest Git tag matching a given prefix (e.g. `v`
→ `v1.2.3`, or `module/v` → `module/v1.2.3`) and exposes useful outputs for
release/version workflows.

## What it does

Given a `tag-prefix`, this action:

- Finds tags that start with the provided prefix
- Determines the _latest_ matching tag
- Outputs:
  - the latest tag (with and without the `refs/tags/` prefix)
  - the parsed version (e.g. `1.2.3`)
  - a JSON blob with the next major/minor/patch tag+version values

### Limitations

This is really only built to support basic version like
`<major>.<minor>.<patch>`. It doesn't really support pre-release versions with
suffixes like `-beta.1`, `alpha.2+build1234`, etc.A

## Inputs

| Name           | Required | Default               | Description                                                                                   |
| -------------- | -------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `github-token` | ✅       | `${{ github.token }}` | GitHub token used for authentication and API access.                                          |
| `tag-prefix`   | ✅       | `v`                   | Prefix to filter tags by. Examples: `v` matches `v1.0.0`; `module/v` matches `module/v1.0.0`. |

## Outputs

| Name                | Description                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `latest-tag`        | The latest matching tag **without** `refs/tags/` (e.g. `v1.2.3` or `module/v1.2.3`).                        |
| `latest-tag-raw`    | The latest matching tag **with** full ref (e.g. `refs/tags/v1.2.3`).                                        |
| `latest-version`    | The parsed version of the latest tag (e.g. `1.2.3` from `module/v1.2.3`).                                   |
| `new-versions-json` | JSON string containing the next `major`, `minor`, and `patch` tag+version computed from the latest version. |

### `new-versions-json` format

```json
{
  "major": { "tag": "module/v2.0.0", "version": "2.0.0" },
  "minor": { "tag": "module/v1.3.0", "version": "1.3.0" },
  "patch": { "tag": "module/v1.2.4", "version": "1.2.4" }
}
```
