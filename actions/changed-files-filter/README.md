# changed-files-filter

A GitHub Action for fine-grained, per-job run control in GitHub Actions
workflows. It answers the question: _"should this job run given what just
happened?"_ — and produces one boolean output per named trigger so downstream
jobs can gate themselves with a simple `if:` condition.

## The problem it solves

GitHub Actions workflows are commonly triggered by many different event types
(`pull_request`, `push`, `merge_group`, `schedule`, `workflow_dispatch`, etc.).
Within a single workflow run, only a subset of jobs typically need to execute —
and which subset depends on both _what changed_ and _how the workflow was
triggered_.

The naive approach is to duplicate that logic in every job:

```yaml
if: |
  contains(github.event.pull_request.labels.*.name, 'run-integration') ||
  steps.filter.outputs.integration == 'true' ||
  github.event_name == 'schedule' ||
  github.event_name == 'workflow_dispatch'
```

This pattern is verbose, easy to get wrong, and has to be repeated for every job
that shares the same conditions. It also requires understanding and remembering
which events carry file-change information and which do not.

This action centralises all of that logic into a single step. You define named
**triggers** — each describing the file paths that are relevant to a job and the
non-file-change event types that should unconditionally run it — and the action
produces a boolean output per trigger. Downstream jobs just check one output:

```yaml
if: needs.detect-changes.outputs.integration == 'true'
```

### Two axes of control

Each trigger independently evaluates two things:

1. **File changes** — on `pull_request`, `push`, and `merge_group` events, the
   action fetches the changed file list and tests it against the trigger's glob
   patterns. The trigger matches if any file (after exclusions) matches any
   positive pattern.

2. **Event type** — on events that do not carry changed-file information (e.g.
   `schedule`, `workflow_dispatch`), file matching is skipped entirely. Instead,
   each trigger has an `always-trigger-on` list (defaulting to
   `[schedule, workflow_dispatch]`). If the current event is in that list, the
   trigger outputs `true` unconditionally. If it is not, a warning is logged and
   the trigger outputs `false`.

This makes it straightforward to express rules like _"run integration tests when
relevant files change on a PR, but always run them on a scheduled nightly
build"_ without any extra workflow logic.

This action is intended to replace usages of
[dorny/paths-filter](https://github.com/dorny/paths-filter) where negated
pattern behavior was ambiguous or unintuitive, and to consolidate the common
pattern of also gating jobs on event type (e.g. `schedule`,
`workflow_dispatch`).

#### The key difference for path filtering from dorny/paths-filter

**Negated patterns are exclusion filters over the changed file set, not part of
a combined match expression.**

In dorny/paths-filter, a pattern like `!**/ignored/**` participates in the same
match evaluation as positive patterns, leading to surprising results depending
on pattern order and combination.

In this action, the evaluation for each named trigger is strictly two-phase:

1. **Exclusion pass:** All negated patterns (those beginning with `!`) are
   applied first. Any changed file that matches a negated pattern is removed
   from the candidate set for this trigger.
2. **Positive match pass:** The remaining candidate files are tested against the
   positive patterns. If any candidate matches any positive pattern, the trigger
   output is `true`.

This means negated patterns never "block" a positive match — they _remove files
from consideration_ before any positive matching occurs.

## Supported events

| Event               | Behavior                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `pull_request`      | GitHub API (`pulls.listFiles`) (falls back to `git diff --name-only`)     |
| `push`              | `git diff --name-only`                                                    |
| `merge_group`       | `git diff --name-only`                                                    |
| `schedule`          | All triggers output `true` (default `always-trigger-on`)                  |
| `workflow_dispatch` | All triggers output `true` (default `always-trigger-on`)                  |
| other               | Warning logged, all triggers output `false` unless in `always-trigger-on` |

## Inputs

| Input             | Required | Default                   | Description                                                      |
| ----------------- | -------- | ------------------------- | ---------------------------------------------------------------- |
| `github-token`    | yes      | `${{ github.token }}`     | GitHub token for API access                                      |
| `repository-root` | no       | `${{ github.workspace }}` | Repo root directory, used for git-based diff on push/merge_group |
| `file-sets`       | no       | —                         | YAML string of named file-set pattern groups (see below)         |
| `triggers`        | yes      | —                         | YAML string of named triggers (see below)                        |

## Outputs

### Static outputs

| Output                      | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `triggers-matched`          | Comma-separated list of trigger names that matched       |
| `triggers-not-matched`      | Comma-separated list of trigger names that did not match |
| `triggers-matched-json`     | JSON array of trigger names that matched                 |
| `triggers-not-matched-json` | JSON array of trigger names that did not match           |

### Dynamic outputs

For each named trigger defined in `triggers`, the action sets a dynamic output
with the trigger's name. The value is `"true"` if the trigger matched, `"false"`
otherwise.

For example, with triggers named `core` and `docs`, the action sets:

```
core = "true" or "false"
docs = "true" or "false"
```

These outputs are not listed in `action.yml` (since their names depend on user
input), but they are set via `core.setOutput` and are accessible in your
workflow as `steps.<step-id>.outputs.<trigger-name>`.

## Triggers input format

The `triggers` input is a YAML string. Each top-level key is a trigger name.
Each trigger is a mapping with the following keys:

| Key                 | Required | Default                         | Description                                                                   |
| ------------------- | -------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `inclusion-sets`    | no       | —                               | File-set names whose patterns are matched against changed files               |
| `exclusion-sets`    | no       | —                               | File-set names whose patterns are excluded before positive matching           |
| `paths`             | no       | —                               | Inline glob patterns; prefix with `!` for one-off exclusions                  |
| `always-trigger-on` | no       | `[schedule, workflow_dispatch]` | Event names that always output true for this trigger, bypassing file matching |

A trigger must have at least one way to ever output `true`: at least one
positive pattern from `inclusion-sets` or `paths`, or at least one entry in
`always-trigger-on`.

### Example

```yaml
triggers: |
  deployment-tests:
    inclusion-sets: [go-files, workflow-files]
    exclusion-sets: [vendor-paths]
    paths:
      - "deployment/**"
    # always-trigger-on defaults to [schedule, workflow_dispatch]

  docs:
    paths:
      - "docs/**"
      - "*.md"
    # override to never auto-trigger on schedule/workflow_dispatch
    always-trigger-on: []

  nightly-only:
    # no file patterns — only fires on the listed events
    always-trigger-on:
      - schedule
      - workflow_dispatch
```

### `always-trigger-on` semantics

On events listed in `always-trigger-on` (defaulting to `schedule` and
`workflow_dispatch`), the trigger outputs `true` without inspecting changed
files at all. This replaces patterns like:

```yaml
# Before: manual GHA logic needed
should-run: >-
  ${{
    steps.filter.outputs.deployment == 'true' ||
    github.event_name == 'schedule' ||
    github.event_name == 'workflow_dispatch'
  }}

# After: handled automatically by always-trigger-on default
should-run: ${{ steps.filter.outputs.deployment }}
```

For any other non-file-change event not listed in `always-trigger-on`, a warning
is logged and the trigger outputs `false`.

## `file-sets` input format

`file-sets` is an optional YAML string defining reusable named groups of glob
patterns that multiple triggers can reference. This avoids repeating the same
patterns across triggers.

File-sets must contain **positive patterns only** — no `!` prefixes. Exclusion
is expressed at the trigger level via `exclusion-sets`, keeping file-set
definitions simple and reusable in either role.

```yaml
file-sets: |
  go-files:
    - "**/*.go"
    - "**/go.mod"
    - "**/go.sum"
  vendor-paths:
    - "**/vendor/**"
  system-tests:
    - "system-tests/**"
```

Triggers reference file-sets via `inclusion-sets` (add as positive patterns) or
`exclusion-sets` (add as negated patterns), and can combine both:

```yaml
triggers: |
  core-tests:
    inclusion-sets: [go-files]
    exclusion-sets: [vendor-paths, system-tests]
    paths:
      - "tools/bin/go_core_tests"
```

Patterns are assembled in order — inclusion-sets, then exclusion-sets, then
inline `paths` — and then split into negated/positive for the two-phase
evaluation.

### Negation semantics

Patterns that begin with `!` are **exclusion patterns**. They are evaluated as a
separate pre-pass:

1. All files matching any `!pattern` are removed from the candidate set for that
   trigger.
2. Positive patterns are then evaluated against the remaining candidates.

**Example:**

Changed files:

```
core/foo.go
ignored-paths/bar.go
docs/index.md
```

Trigger `core-tests` with patterns `!**/ignored-paths/**`, `**/*.go`:

- Exclusion pass: `ignored-paths/bar.go` is removed.
- Positive pass: `core/foo.go` matches `**/*.go`.
- Result: `core-tests = "true"`.

Note that `ignored-paths/bar.go` is excluded _before_ the `**/*.go` check, so it
never has a chance to match.

### Rules

- A trigger must have at least one way to ever output `true`: either at least
  one positive pattern (via `inclusion-sets` or `paths`) for file-change
  matching, or at least one entry in `always-trigger-on`. A trigger with neither
  will be rejected.
- If patterns are specified, the combined set must include at least one positive
  pattern. Using only `exclusion-sets` (no `inclusion-sets` or `paths`) will be
  rejected. To skip file matching entirely, omit pattern keys and rely solely on
  `always-trigger-on`.
- File-sets must contain only positive patterns — `!` is not allowed in file-set
  definitions.
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
      - uses: actions/checkout@v4
      - id: filter
        uses: smartcontractkit/.github/actions/changed-files-filter@main
        with:
          file-sets: |
            go-files:
              - "**/*.go"
              - "**/go.mod"
              - "**/go.sum"
            vendor-paths:
              - "**/vendor/**"
          triggers: |
            core:
              inclusion-sets: [go-files]
              exclusion-sets: [vendor-paths]
              # schedule and workflow_dispatch always trigger (default)
            docs:
              paths:
                - docs/**
                - "*.md"
              always-trigger-on: []  # only run on file changes

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
- Reads triggers from `scripts/filters.yml` (override with `INPUT_TRIGGERS`)
- Points at a real PR on `smartcontractkit/.github`

To test against a different repo or PR, set `GITHUB_REPOSITORY` and update
`scripts/payload.json` with the desired PR number before running.

To test against a local repository with push-style changed files (git diff), set
`INPUT_REPOSITORY_ROOT` to point at your local checkout and change
`GITHUB_EVENT_NAME` to `push` with appropriate `before`/`after` SHAs in the
payload.
