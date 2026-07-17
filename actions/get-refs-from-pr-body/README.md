# get-refs-from-pr-body

Extracts per-repo git refs from a PR body, resolves them to concrete commit
SHAs, and verifies each SHA through the internal SigScanner service before
returning them as outputs. Any override that fails validation, resolution, or
signature verification fails the action.

The migration from `tools/scripts/get-refs-from-pr-body.js` preserves the
original PR-body parsing behavior (three chain repos: `core`, `solana`,
`starknet`) and adds SHA resolution + verification.

## What it does

1. Skips silently on non-`pull_request` events, emitting each repo's default ref
   so downstream jobs continue to work on `push`, `schedule`, etc.
2. Fetches the PR body for the invoking pull request.
3. For each configured repo (`core`, `solana`, `starknet`):
   - If the PR body contains an override (`<name> ref: <value>`):
     - Syntactically validates the ref (SHA, semver tag, or branch/tag name).
     - Resolves it to a 40-char commit SHA against the target repository via the
       GitHub API.
     - Verifies that SHA through SigScanner.
   - If no override is present, emits the hardcoded default ref (`develop`)
     as-is — no resolution or verification, since defaults point at trusted
     baseline branches.
4. If every override succeeds, sets an output per repo containing the **resolved
   SHA** (or the raw default ref for defaulted repos). If any override fails at
   any step, the action fails with a report of every failure.

### Behavior change vs. the old script

The old script wrote the raw ref (e.g. `develop`) to its output. This action
writes the **resolved SHA** for any ref that came from the PR body, so
downstream `actions/checkout` steps pin to the exact commit that was verified —
closing the race where a branch's HEAD can move between validation and checkout.

Defaults are emitted as raw refs (`develop`), unchanged from the old behavior.
This covers all skip paths (non-`pull_request` event, empty PR body, PR body
without any recognized overrides) and also per-repo defaulting (when the PR body
has overrides for some but not all repos).

## Repo configuration

Hardcoded in `src/repo-config.ts`. Add a new entry there to support another
chain repo — no input changes needed.

| Name       | PR body pattern     | Default   | Target repo                           |
| ---------- | ------------------- | --------- | ------------------------------------- |
| `core`     | `core ref: ...`     | `develop` | `smartcontractkit/chainlink`          |
| `solana`   | `solana ref: ...`   | `develop` | `smartcontractkit/chainlink-solana`   |
| `starknet` | `starknet ref: ...` | `develop` | `smartcontractkit/chainlink-starknet` |

## Inputs

| Name                 | Required | Default               | Description                                                                                                                                       |
| -------------------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`       | ✅       | `${{ github.token }}` | GitHub token used to fetch the invoking PR body and to resolve refs to SHAs on the target repos. Must have read access to each target repository. |
| `sigscanner-url`     | ✅       | —                     | SigScanner endpoint URL. Typically an org-wide secret.                                                                                            |
| `sigscanner-api-key` | ✅       | —                     | SigScanner API key. Typically an org-wide secret.                                                                                                 |

## Outputs

| Name           | Description                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core-ref`     | For overrides: resolved and SigScanner-verified commit SHA for `smartcontractkit/chainlink`. When defaulted: the raw default ref (`develop`).          |
| `solana-ref`   | For overrides: resolved and SigScanner-verified commit SHA for `smartcontractkit/chainlink-solana`. When defaulted: the raw default ref (`develop`).   |
| `starknet-ref` | For overrides: resolved and SigScanner-verified commit SHA for `smartcontractkit/chainlink-starknet`. When defaulted: the raw default ref (`develop`). |

## Example usage

```yaml
jobs:
  init:
    runs-on: ubuntu-latest
    outputs:
      core-ref: ${{ steps.refs.outputs.core-ref }}
      solana-ref: ${{ steps.refs.outputs.solana-ref }}
      starknet-ref: ${{ steps.refs.outputs.starknet-ref }}
    steps:
      - name: Resolve PR body refs
        id: refs
        uses: smartcontractkit/.github/actions/get-refs-from-pr-body@<sha>
        with:
          sigscanner-url: ${{ secrets.SIGSCANNER_URL }}
          sigscanner-api-key: ${{ secrets.SIGSCANNER_API_KEY }}

  build-core:
    needs: init
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: smartcontractkit/chainlink
          ref: ${{ needs.init.outputs.core-ref }}
```
