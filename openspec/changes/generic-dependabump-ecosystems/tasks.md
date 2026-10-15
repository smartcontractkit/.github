# Tasks

## 1. Inputs and validation

- [x] 1.1 Add `ecosystem` (string, default `go`) and `bump-command` (string, optional) inputs to `workflows/reusable-dependabump/reusable-dependabump.yml`; verify with `actionlint` on the file.
- [x] 1.2 Add a `validate` step (D1) that checks `severity` with the existing regex, checks each `ecosystem` entry against the D5 allow-list (case-insensitive), and fails when `bump-command` is empty and any entry is not `go`; emit normalized `severity` and `ecosystem` outputs with `| tee -a "$GITHUB_OUTPUT"`. Verify by running the step's script locally with `ecosystem` set to `go`, ` NPM , rust`, `cargo`, and `npm` (no bump command): the first two pass, the last two fail with a message naming the problem.
- [x] 1.3 Add `steps.validate.outcome == 'failure'` to the "Notify Failure" and "Exit on Failure" conditions; verify with `actionlint` and by reading the conditions.

## 2. Alerts query and file

- [x] 2.1 Add an `alerts` step that queries `/repos/$GITHUB_REPOSITORY/dependabot/alerts?state=open&ecosystem=<list>&severity=<list>` with `--paginate`, keeps alerts with `first_patched_version != null`, merges pages with `jq -s 'add // []'`, maps to the spec's fields (`ecosystem`, `manifest_path`, `package`, `patched_version`, `vulnerable_version_range`, `severity`, `ghsa_id`), writes `$RUNNER_TEMP/dependabump-alerts.json`, and outputs `file` and `count`. Verify by running the `gh api … | jq` pipeline locally against a repo that has open alerts and checking the JSON shape and count.
- [x] 2.2 Add `steps.alerts.outcome == 'failure'` to the failure gate; verify with `actionlint`.

## 3. Bump paths

- [x] 3.1 Gate "Set up Go", `GOTOOLCHAIN=auto`, and "Install tools" on `steps.alerts.outputs.count != '0' && inputs.bump-command == ''`; verify with `actionlint` and by reading the conditions.
- [x] 3.2 Replace the `bump` step with `bump-go`: build `./<dir> <package> <patched_version>` lines from the alerts file (`manifest_path | rtrimstr("go.mod")`), pipe to `dependabot`, run `gomods tidy`. Verify the `jq` transform locally on a sample alerts file produces the same lines the 1.0.4 query produced.
- [x] 3.3 Add `bump-custom`: runs when `count != '0'` and `bump-command` is set, exports `DEPENDABUMP_ALERTS_FILE` and passes the command through `env`, then `eval "$BUMP_COMMAND"`; verify with `actionlint` and that no `${{ inputs.bump-command }}` is interpolated inside `run:`.
- [x] 3.4 Add a `changed` step after both bump steps (runs when either succeeded) that writes `changed=true|false` from `git status --porcelain` via `| tee -a "$GITHUB_OUTPUT"`; point Nix install and post-bump conditions at `steps.changed.outputs.changed`, and add `bump-go`/`bump-custom`/`install` outcomes to the failure gate. Verify with `actionlint` and by tracing that `count == 0` skips bump, post-bump, and the PR step.
- [x] 3.5 Make "Create Pull Request" run only when `steps.changed.outputs.changed == 'true'`; verify by reading the condition and that 1.0.4 behavior for changed Go runs is otherwise unchanged.
- [x] 3.6 Run `pnpm workflows:fix` (or `tools/scripts/sync-reusable-workflows.sh`) to sync `.github/workflows/reusable-dependabump.yml`; verify the only diff between the two files is the generated header.

## 4. Documentation and release

- [x] 4.1 Update `workflows/reusable-dependabump/README.md`: inputs table (`severity`, `ecosystem`, `bump-command`, `post-bump-command`), the alerts file format with an example, the tool → API value mapping (`cargo`→`rust`, `pnpm`/`yarn`→`npm`, `uv`/`poetry`→`pip`), and the D4 no-alerts behavior. Verify the Go example is unchanged and still valid.
- [ ] 4.2 Add README `bump-command` recipes for npm/pnpm (`pnpm update`/`pnpm.overrides`), cargo (`cargo update -p <pkg> --precise <ver>`), and pip/uv (`uv lock --upgrade-package <pkg>==<ver>`), each reading `DEPENDABUMP_ALERTS_FILE` with `jq` and running in `dirname` of `manifest_path`. Verify each recipe's loop by running it locally against a sample alerts file and a throwaway project for that tool.
- [ ] 4.3 Add a `.changeset/*.md` minor entry for `reusable-dependabump` describing the new inputs and the no-alerts skip (D4); verify with `pnpm changeset status`.

## 5. Integration check

- [x] 5.1 Run `actionlint` on both workflow copies and confirm no errors.
- [ ] 5.2 Exercise the workflow from a test branch in a Go repo (no new inputs) and a non-Go repo (`ecosystem` + `bump-command`) via `workflow_dispatch` calling the branch ref; confirm the Go run matches 1.0.4 behavior and the non-Go run opens a PR with the expected lockfile changes.
