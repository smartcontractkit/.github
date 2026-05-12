# semver-compare

Compares two semantic version strings using a specified operator.

Very simple wrapper around the [semver](https://www.npmjs.com/package/semver)
package.

## Build

Make sure you build and commit the built files.

```shell
npm nx run semver-compare:build
```

## Inputs

| Name       | Description                              | Required |
| ---------- | ---------------------------------------- | -------- |
| `version1` | First semantic version (e.g. `1.2.3`)    | Yes      |
| `version2` | Second semantic version (e.g. `2.0.0`)   | Yes      |
| `operator` | Comparison operator: `gt`, `lt`, or `eq` | Yes      |

### Operators

- `gt` → greater than
- `lt` → less than
- `eq` → equal to

## Outputs

| Name     | Description                         |
| -------- | ----------------------------------- |
| `result` | `true` or `false` comparison result |

## Usage

```yaml
jobs:
  compare:
    runs-on: ubuntu-latest
    steps:
      - name: Compare versions
        id: semver
        uses: smartcontractkit/.github/actions/semver-compare@<ref>
        with:
          version1: "1.2.3"
          version2: "2.0.0"
          operator: "lt"

      - name: Use result
        run: echo "Comparison result is ${{ steps.semver.outputs.result }}"
```
