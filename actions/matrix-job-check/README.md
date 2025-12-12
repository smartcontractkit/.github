# matrix-job-check

This action allows you to properly assert the result of matrix jobs.

## Usage

| Input                 | Desciption                                                                                | Default                |
| --------------------- | ----------------------------------------------------------------------------------------- | ---------------------- |
| `workflow-run-id`     | The workflow run id (not job). The default is probably all you should ever need.          | `${{ github.run_id }}` |
| `job-name-prefix`     | The prefix of all the jobs you'd like to consider as part of the matrix                   | N/A - required         |
| `assert-jobs-exist`   | Assert that jobs exist (ie. the matrix was actually created, and that prefix is accurate) | `true`                 |
| `assert-successful`   | Assert that jobs w/ matching prefix were successful                                       | `false`                |
| `asssert-no-failures` | Assert that jobs w/ matching prefix did not fail (allows skips, etc.)                     | `true`                 |
| `assert-no-cancels`   | Assert that jobs w/ matching prefix were not cancelled                                    | `true`                 |

### Example Workflow

```yaml
name: example

on:
  merge_group:
  pull_request:
  push:

  # This job creates a JSON array of modified modules that will be used
  # to create the matrix in the "lint" job below
  init:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
    outputs:
      changed-modules: ${{ steps.changed-modules.outputs.modules-json }}
    steps:
      - name: Checkout repo (needed to reference local action)
        uses: actions/checkout@v5
        with:
          persist-credentials: false

      - name: Changed modules
        id: changed-modules
        uses: smartcontractkit/.github/actions/changed-modules-go@<tag>
        with:
          no-change-behaviour: all
          file-patterns: |
            **/*.go
            **/go.mod
            **/go.sum
          module-patterns: |
            **
            !path/to/ignore/**

  # This job uses a matrix strategy to lint the individual modules
  # This will spawn in 0-n jobs.
  lint:
    name: Lint - ${{ matrix.modules }}
    needs: [ init ]
    runs-on: ubuntu-latest

    permissions:
      ...
    strategy:
      fail-fast: false
      matrix:
        modules: ${{ fromJson(needs.init.outputs.changed-modules) }}
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          persist-credentials: false

      - name: Lint
        id: golang-lint
        uses: smartcontractkit/.github/actions/ci-lint-go@<tag>
        timeout-minutes: 20
        with:
          go-directory: ${{ matrix.modules }}
          only-new-issues: true

  # This job runs after linting, and acts as the aggregated checker.
  # This is useful when adding required checks.

  lint-results:
    name: Lint Results
    needs: [ "init", "lint" ]
    runs-on: "ubuntu-latest"
    permissions:
      actions: read

    steps:
      - name: Verify job results
        uses: smartcontractkit/.github/actions/matrix-job-check@<tag>
        with:
          job-name-prefix: "Lint - "
          # Only assert that jobs exist if the matrix array was non-empty
          assert-jobs-exist: ${{ needs.init.outputs.changed-modules != "[]" }}
          assert-no-failures: "true"

          # OR, as an example:
          #  - allow failures if PR was labelled with 'allow-lint-issues'
          assert-no-failures: ${{ contains(join(github.event.pull_request.labels.*.name, ' '), 'allow-lint-issues') }}

```

## Development

1. Update dist: `pnpm nx run build matrix-job-check`
2. Run tests: `pnpm nx run test matrix-job-check`
3. Record Fixtures (new only):
   `NOCK_BACK_MODE=record pnpm nx test matrix-job-check`
4. Update Fixtures (existing only):
   `NOCK_BACK_MODE=update pnpm nx test matrix-job-check`
