# changed-files-filter

A GitHub Action that detects changed files for the current GitHub Actions event
and filters them using named glob filter patterns. Each filter produces a
boolean output indicating whether any changed file matched that filter.

This action is intended to replace usages of
[dorny/paths-filter](https://github.com/dorny/paths-filter) where negated
pattern behavior was ambiguous or unintuitive.

## The key difference from dorny/paths-filter

**Negated patterns are exclusion filters over the changed file set, not part of
a combined match expression.**

In dorny/paths-filter, a pattern like `!**/ignored/**` participates in the same
match evaluation as positive patterns, leading to surprising results depending
on pattern order and combination.

In this action, the evaluation for each named filter is strictly two-phase:

1. **Exclusion pass:** All negated patterns (those beginning with `!`) are
   applied first. Any changed file that matches a negated pattern is removed
   from the candidate set for this filter.
2. **Positive match pass:** The remaining candidate files are tested against the
   positive patterns. If any candidate matches any positive pattern, the filter
   output is `true`.

This means negated patterns never "block" a positive match — they _remove files
from consideration_ before any positive matching occurs.

## Supported events

| Event          | Changed file source                                                   |
| -------------- | --------------------------------------------------------------------- |
| `pull_request` | GitHub API (`pulls.listFiles`) (falls back to `git diff --name-only`) |
| `push`         | `git diff --name-only`                                                |
| `merge_group`  | `git diff --name-only`                                                |

All other event types cause the action to fail with a clear error.

## Inputs

| Input             | Required | Default                   | Description                                                      |
| ----------------- | -------- | ------------------------- | ---------------------------------------------------------------- |
| `github-token`    | yes      | `${{ github.token }}`     | GitHub token for API access                                      |
| `repository-root` | no       | `${{ github.workspace }}` | Repo root directory, used for git-based diff on push/merge_group |
| `filters`         | yes      | —                         | YAML string of named filters (see below)                         |

## Outputs

### Static outputs

| Output                     | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `filters-matched`          | Comma-separated list of filter names that matched       |
| `filters-not-matched`      | Comma-separated list of filter names that did not match |
| `filters-matched-json`     | JSON array of filter names that matched                 |
| `filters-not-matched-json` | JSON array of filter names that did not match           |

### Dynamic outputs

For each named filter defined in `filters`, the action sets a dynamic output
with the filter's name. The value is `"true"` if the filter matched, `"false"`
otherwise.

For example, with filters named `core` and `docs`, the action sets:

```
core = "true" or "false"
docs = "true" or "false"
```

These outputs are not listed in `action.yml` (since their names depend on user
input), but they are set via `core.setOutput` and are accessible in your
workflow as `steps.<step-id>.outputs.<filter-name>`.

## Filters input format

The `filters` input is a YAML string. Each top-level key is a filter name; its
value is a list of glob patterns:

```yaml
filters: |
  core:
    - !**/ignored-1/**
    - !**/ignored-2/**
    - **/*.go
    - **/go.mod
    - **/go.sum
    - testdata/**/*.txtar
  github_ci_changes:
    - .github/workflows/*.yml
    - .github/workflows/*.yaml
```

### Negation semantics

Patterns that begin with `!` are **exclusion patterns**. They are evaluated as a
separate pre-pass:

1. All files matching any `!pattern` are removed from the candidate set for that
   filter.
2. Positive patterns are then evaluated against the remaining candidates.

**Example:**

Changed files:

```
core/foo.go
ignored-1/bar.go
docs/index.md
```

Filter `core` with patterns `!**/ignored-1/**`, `**/*.go`:

- Exclusion pass: `ignored-1/bar.go` is removed.
- Positive pass: `core/foo.go` matches `**/*.go`.
- Result: `core = "true"`.

Note that `ignored-1/bar.go` is excluded _before_ the `**/*.go` check, so it
never has a chance to match.

### Rules

- At least one positive pattern is required per filter. A filter with only
  negated patterns is invalid and will cause the action to fail.
- Blank lines in the pattern list are ignored.
- Patterns are matched against repo-relative POSIX paths (e.g.
  `src/foo/bar.ts`).
- Matching uses [micromatch](https://github.com/micromatch/micromatch) with
  `{ dot: true }`, so patterns match dotfiles/directories.

## Example workflow usage

```yaml
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      core: ${{ steps.filter.outputs.core }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: actions/checkout@v6
      - id: filter
        uses: smartcontractkit/.github/actions/changed-files-filter@changed-files-filter/v1
        with:
          filters: |
            core:
              - !**/vendor/**
              - **/*.go
              - **/go.mod
              - **/go.sum
            docs:
              - docs/**
              - '*.md'

  build-core:
    needs: detect-changes
    if: needs.detect-changes.outputs.core == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Running core build"

  build-docs:
    needs: detect-changes
    if: needs.detect-changes.outputs.docs == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Running docs build"
```

## Local testing

A local test script is provided at `scripts/test.sh`. It simulates a
`pull_request` event against a real PR on this repository:

```bash
cd /path/to/.github
bash actions/changed-files-filter/scripts/test.sh
```

The script:

- Builds the action via `pnpm nx build changed-files-filter`
- Sets `CL_LOCAL_DEBUG=true`, which switches input resolution to read from
  `INPUT_<LOCALPARAMETER>` env vars instead of the action.yml parameter names
- Reads filters from `scripts/filters.yml` (override with `INPUT_FILTERS`)
- Points at a real PR on `smartcontractkit/.github`

To test against a different repo or PR, set `GITHUB_REPOSITORY` and update
`scripts/payload.json` with the desired PR number before running.

To test against a local repository with push-style changed files (git diff), set
`INPUT_REPOSITORY_ROOT` to point at your local checkout and change
`GITHUB_EVENT_NAME` to `push` with appropriate `before`/`after` SHAs in the
payload.

## Limitations

- Only `pull_request`, `push`, and `merge_group` events are supported. The
  action will fail for other event types.
- Filters must have at least one positive pattern. Filters with only negated
  patterns are rejected.
- On `push` and `merge_group` events, the repository must be checked out (the
  default `actions/checkout` behavior) for `git diff` to work.
