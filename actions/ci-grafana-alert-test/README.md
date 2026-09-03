# ci-grafana-alert-test

A CD quality gate for Grafana alerts. It bookends a release with two calls to
this action — `record` before the deploy, `check` after the work is done — and
answers one question: _was any watched alert in a bad state at any point during
the release window?_

It wraps the
[`grafana-alertcheck`](https://github.com/smartcontractkit/chainlink-testing-framework/tree/main/grafana-alertcheck)
CLI from `chainlink-testing-framework`. There is no versioned release of that
CLI yet, so this action builds it from source at run time with `go tool` (Go >=
1.24's native tool-dependency support) rather than downloading a release asset.
**Pin `ctf-ref` to a commit SHA** once you depend on this in a real pipeline — a
branch name will silently change what runs underneath you.

## Usage

```yaml
- uses: smartcontractkit/.github/actions/ci-grafana-alert-test@ci-grafana-alert-test/v1
  with:
    mode: record
    grafana-url: ${{ vars.GRAFANA_URL }}
    grafana-token: ${{ secrets.GRAFANA_TOKEN }}
    alerts: |
      My Service Latency
      My Service Error Rate
    ctf-ref: <commit-sha>

- id: deploy
  run: ./deploy.sh # emits deployed_at=<RFC3339> when the rollout is stable

- id: work
  run: ./verify.sh # emits finished_at=<RFC3339> when done (tests, traffic, whatever)

- uses: smartcontractkit/.github/actions/ci-grafana-alert-test@ci-grafana-alert-test/v1
  with:
    mode: check
    grafana-url: ${{ vars.GRAFANA_URL }}
    grafana-token: ${{ secrets.GRAFANA_TOKEN }}
    ctf-ref: <commit-sha>
    from: ${{ steps.deploy.outputs.deployed_at }}
    to: ${{ steps.work.outputs.finished_at }} # ...or `duration: 10m` when there is no done event — never both
```

`record` and `check` must run in the **same job, on the same runner** — nothing
is passed between jobs or between run attempts. `from` must come from the deploy
step's own completion output, never from a wrapper step around it; a single step
must not serve its own completion as `from`, or the window between landing and
finishing is never observed at all.

## What it checks, and what it does not

- The gate checks the **state and health** of an alert. It does **not** check
  whether a notification was ever delivered. **A silenced alert that fires still
  fails the gate.**
- The gate needs Grafana 13.x.
- **A fix that stops emitting a metric does not look like a recovery.** An
  instance that vanishes while bad stays a failure — a missing series is a
  discontinuity, not evidence of health.
- **A paused rule fails the gate by default** (`allow-paused: 'false'`). If
  someone else paused an alert you're watching, your release fails on it — the
  alternative is silently watching fewer alerts than you asked for.

## Retries

**A retry is a new deploy, not a replay.** There is no cheap re-check: each
`check` run classifies its own freshly recorded window, and on failure the
evidence log is **uploaded, never downloaded** — so a rerun cannot replay old
evidence to pass. A second attempt legitimately relabeling the same commit
`newly_bad` on attempt 1 and `persistently_bad` on attempt 2 is correct, not a
bug — the exit code is the same, the label is more accurate.

## Timing

`record` blocks for a short time — until it has observed every non-paused
watched alert at least once — before it detaches and returns. This is
intentional: it closes the blind interval between the deploy landing and the
gate actually watching it.

A gate with a 10-minute window (`to − from`) holds the runner for
**approximately 10 minutes plus grace and drain time**, printed at the start of
the `check` step. There is no early exit — the gate observes the full window
even after it already knows the answer, because early-exiting is exactly what
would reopen the coverage gap this whole tool exists to close. Make sure the
surrounding job's timeout accounts for this.

## Failure behaviour

- `fail-on-violation: 'false'` suppresses a **violation** (exit 1) only. A
  **could-not-check** result (exit 2 — auth failure, coverage gap, an
  unobservable rule, a schedule that doesn't fit, and so on) always fails the
  job: an inability to answer is never a pass.
- On any non-zero `check` exit, the JSONL evidence log is uploaded as
  `grafana-alert-gate-log-${{ github.run_id }}-${{ github.run_attempt }}` for
  diagnosis after the runner is gone.
- `to` and `duration` are mutually exclusive on `mode: check` — give exactly
  one. There is deliberately no default for either; a 10-minute gate is a choice
  you make explicitly, not one this action makes for you.

## Inputs

See [action.yml](action.yml) for the full, authoritative list with defaults. The
ones worth calling out:

| Input                      | Notes                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                     | `record` or `check`                                                                                                                          |
| `alerts`                   | One alert name per line. `record` only — `check` reads the set from the recorded log, and giving both is an error                            |
| `ctf-ref`                  | git ref of `chainlink-testing-framework` to build `grafana-alertcheck` from. **Pin to a commit SHA**                                         |
| `from` / `to` / `duration` | `check` only. `from` is when the deploy landed; `to` is when the work ended; `duration` replaces `to` when there is no distinct "done" event |
| `fail-on-violation`        | Default `true`. Stops exit 1 only, never exit 2                                                                                              |

## Outputs

`record` sets `log-path` and `pidfile` for transparency; `check` finds them by
convention, so you never need to wire them through yourself. `check` sets
`passed`, `violation-count`, `violations` (JSON), and `outcomes` (JSON, one
`{alert, outcome}` entry per resolved rule).

## Runner requirements

Linux (`ubuntu-*`) runners only — the window arithmetic uses GNU `date`.
