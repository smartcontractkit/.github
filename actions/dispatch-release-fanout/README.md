# dispatch-release-fanout

Tells a release fan-out hub which images a build published. The hub classifies
each tag into a release channel and opens image-bump PRs in the deployment repos
subscribed to it. One call carries every image a build published.

The dispatch carries this job's GitHub OIDC token as the `id-token` input. The
hub verifies it and checks that `repository` equals `producer` and that
`workflow_ref` matches the producer's pinned workflow and ref. A person cannot
mint this token, so the hub cannot be dispatched by hand.

## Usage

The calling job needs `id-token: write`.

```yaml
jobs:
  dispatch-release-fanout:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: smartcontractkit/.github/actions/dispatch-release-fanout@dispatch-release-fanout/v1
        with:
          hub-repo: ${{ secrets.FANOUT_HUB_REPO }}
          audience: ${{ secrets.FANOUT_HUB_AUDIENCE }}
          gati-profile: ${{ secrets.FANOUT_HUB_GATI_PROFILE }}
          images: |
            core=${{ needs.build.outputs.core-tag }}
            ccip=${{ needs.build.outputs.ccip-tag }}
```

An image whose tag is empty is dropped, so an optional image can be passed
unconditionally:

```yaml
images: |
  core=${{ needs.release.outputs.core-tag }}
  ccip=${{ needs.release.outputs.promote-ccip == 'true' && needs.release.outputs.ccip-tag || '' }}
```

If every tag is empty, the action warns, sets `dispatched=false` and does not
dispatch.

## Inputs

| input            | required | default                    | description                                                |
| ---------------- | -------- | -------------------------- | ---------------------------------------------------------- |
| `hub-repo`       | yes      |                            | `owner/name` of the hub repository. Supply from a secret.  |
| `audience`       | yes      |                            | OIDC audience the hub expects. Supply from a secret.       |
| `gati-profile`   | yes      |                            | GATI v2 profile with `actions:write` on the hub.           |
| `images`         | yes      |                            | Multiline `stream=tag` pairs.                              |
| `producer`       | no       | `${{ github.repository }}` | Producer key. The hub requires it to equal the repository. |
| `hub-workflow`   | no       | `fanout.yaml`              | Workflow file in the hub.                                  |
| `hub-ref`        | no       | `main`                     | Branch in the hub to run the workflow from.                |
| `correlation-id` | no       | `<run_id>-<run_attempt>`   | Id carried along every hop of the fan-out.                 |
| `source-run-url` | no       | this run's URL             | Recorded by every downstream hop.                          |

## Outputs

| output       | description                                     |
| ------------ | ----------------------------------------------- |
| `dispatched` | `true` if the hub was dispatched, else `false`. |
| `images`     | JSON array of `{stream, tag}` sent to the hub.  |

## Notes

- Pass `hub-repo`, `audience` and `gati-profile` from secrets. The runner prints
  each step's inputs before it runs, so only secrets are masked from the start.
  The action also masks `hub-repo` and `audience` for later log lines, and never
  writes them to the step summary.
- The token's `workflow_ref` is the caller's top-level workflow, whether this
  action is called directly or from a reusable workflow. If the dispatch moves
  to another top-level workflow, update the producer's identity in the hub.
- The token expires about 5 minutes after it is minted. To redeliver a release,
  re-run this job in the producer. Re-running all jobs of the hub's run fails
  because the token it received has expired; re-running only the failed jobs of
  the hub's run works.
