# ci-grafana-alert-test

A CD quality gate for Grafana alerts. It answers one question: _was any watched
alert in a bad state at any point during the release window?_ Two shapes are
supported:

- **Bookended (recommended):** `record` before the deploy or tests, `check`
  after the work is done — the observation starts before the deploy lands.
- **Live:** a single `live` call that watches and classifies inline, with no
  recorder; anything before the step starts is a declared blind spot.

It wraps the
[`grafana-alertcheck`](https://github.com/smartcontractkit/chainlink-testing-framework/tree/main/grafana-alertcheck)
CLI from `chainlink-testing-framework`. The action downloads a prebuilt release
binary rather than compiling from source — the version is pinned in one place in
the action and bumped by editing that single line when a new release ships.

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

- id: deploy
  run: ./deploy.sh # emits deployed_at=<RFC3339> when the rollout is stable

- id: work
  run: ./verify.sh # emits finished_at=<RFC3339> when done (tests, traffic, whatever)

- uses: smartcontractkit/.github/actions/ci-grafana-alert-test@ci-grafana-alert-test/v1
  with:
    mode: check
    grafana-url: ${{ vars.GRAFANA_URL }}
    grafana-token: ${{ secrets.GRAFANA_TOKEN }}
    from: ${{ steps.deploy.outputs.deployed_at }}
    to: ${{ steps.work.outputs.finished_at }} # ...or `duration: 10m` when there is no done event — never both
```

`record` and `check` must run in the **same job, on the same runner** — nothing
is passed between jobs or between run attempts. `from` must come from the deploy
step's own completion output, never from a wrapper step around it; a single step
must not serve its own completion as `from`, or the window between landing and
finishing is never observed at all.

When there is nothing to bookend — no recorder, just "watch from here until the
work ends" — use `live` instead:

```yaml
- uses: smartcontractkit/.github/actions/ci-grafana-alert-test@ci-grafana-alert-test/v1
  with:
    mode: live
    grafana-url: ${{ vars.GRAFANA_URL }}
    grafana-token: ${{ secrets.GRAFANA_TOKEN }}
    alerts: |
      My Service Latency
      My Service Error Rate
    duration: 10m # the window runs for 10 minutes from the start of this step; `to` works too
```

If the work step fails before `check`/`live` runs, reap the detached recorder so
it stops polling Grafana for the rest of its window:

```yaml
- uses: smartcontractkit/.github/actions/ci-grafana-alert-test@ci-grafana-alert-test/v1
  if: always()
  with:
    mode: stop
```

`stop` is idempotent — it is a no-op after a completed `check`, a previous
`stop`, or when no recorder ever started — and needs no Grafana credentials.
When a recorder did run but `check`/`live` never completed (the work failed
first), `stop` also upserts the summary comment saying the gate did not run, so
the PR is not left with a stale or missing verdict.

## Live mode

`live` is the CLI's single-step mode: it polls Grafana itself for the whole
window and then classifies it, so it needs `alerts` and blocks until `to` (or
the `duration` elapses). Unlike `check`, it does not need a prior `record` and
does not use `from` to anchor the window — the window starts at live's first
observation. If you pass `from` anyway, the CLI just names the interval between
it and the first observation as a blind spot.

The trade-off is exactly that blind interval: live cannot see anything that
happened before the step started, so an alert that fired during the deploy and
cleared before the test step began is missed. Use `record` + `check` when the
deploy window itself must be covered with no gap; use `live` when the step
itself is the work being watched.

`check` and `live` also upsert their summary as a comment on the **open pull
request whose head is the commit the run observed** — this works for
`pull_request`, `deployment_status`, and manually dispatched runs alike. The
calling job needs `pull-requests: write` for that:

```yaml
permissions:
  contents: read
  pull-requests: write
```

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
`check` or `live` run classifies its own freshly observed window, and on failure
the evidence is **uploaded, never downloaded** — so a rerun cannot replay old
evidence to pass. A second attempt legitimately relabeling the same commit
`new_failure` (formerly `newly_bad`) on attempt 1 and `still_failing` (formerly
`persistently_bad`) on attempt 2 is correct, not a bug — the exit code is the
same, the label is more accurate.

## Deploy and test in separate jobs

`record` and `check` would ideally live in one job on one runner, because
`check` finds the recorded log by convention on the local filesystem. If your
deploy and your verification/test work run in **different jobs**, you have to
choose where the gate lives, and that choice trades off against coverage:

- **Record/check in the deploy job only** — the window observes the deploy and
  whatever falls inside its `duration`. Whether it also covers your test job's
  activity depends entirely on how long the gate runs versus when (and how long)
  the test job runs; there is no automated way to know for sure, so any alert
  that fires under test traffic could fall just outside the window.
- **Record/check in the test job only** — there is a **blind window** between
  the deployment becoming ready and the test job's recorder starting. Alerts
  that fire in that span are never seen.

There is no way to shrink that blind window by leaning on one job alone — the
recorder cannot see back in time, it can only watch from the moment it starts.
The way to get **zero gap** is to run the gate in **both** jobs: each job
records its own window, and as long as the deploy job's window end overlaps (or
touches) the test job's window start, the two observations together cover the
whole span with no uncovered interval. The price is two overlapping windows to
classify and, when the same alert fires across the boundary, two violations to
reconcile — but that is strictly better than a silent gap.

## Timing

`record` blocks for a short time — until it has observed every non-paused
watched alert at least once — before it detaches and returns. This is
intentional: it closes the blind interval between the deploy landing and the
gate actually watching it.

A gate with a 10-minute window (`to − from`) holds the runner for
**approximately 10 minutes plus grace and drain time**, printed at the start of
the `check` step. `live` holds it for its whole window the same way. By default
the CLI exits early on a failure that cannot become a pass;
`no-fail-fast: 'true'` instead observes the full window even after it already
knows the answer, because early-exiting is exactly what would reopen the
coverage gap this whole tool exists to close. Make sure the surrounding job's
timeout accounts for this.

## Step summary and pull request comment

`check` and `live` write a Markdown table to the step summary — one row per
alert, with a ✅/❌ status, the verdict, the raw Grafana state and health, how
long it was broken, and any details. When the run exits early, the summary says
so and points at `no-fail-fast`. With `print-instances-details: 'true'` the
failing instances of every bad alert are listed underneath the table (identity
comes from the JSON result the CLI writes for `--output json`).

On pull requests the same body is upserted as a PR comment: the action finds the
open PR whose head is this run's commit (via the commit→pull requests API),
finds its previous comment by a hidden marker, and updates it instead of posting
duplicates on reruns. No PR match, a missing token, or an API rejection is
logged/a warned and skipped — it never fails the gate.

## Failure behaviour

- `fail-on-violation: 'false'` suppresses a **violation** (exit 1) only. A
  **could-not-check** result (exit 2 — auth failure, coverage gap, an
  unobservable rule, a schedule that doesn't fit, and so on) always fails the
  job: an inability to answer is never a pass.
- By default `check` and `live` exit early as soon as they observe a failure
  that cannot become a pass, which is a latency optimization, not a weaker gate.
  Set `no-fail-fast: 'true'` to always wait for the full window and its coverage
  proof (this pulls in the full-window cost described under [Timing](#timing)).
  It requires the CLI release that ships the flag — bump the action's pinned
  version (`v0.1.2` or newer) before using it.
- On any non-zero `check` exit, the JSONL evidence log is uploaded as
  `grafana-alert-gate-log-${{ github.run_id }}-${{ github.run_attempt }}` for
  diagnosis after the runner is gone. `live` has no JSONL log, so it uploads the
  JSON result as
  `grafana-alert-gate-result-${{ github.run_id }}-${{ github.run_attempt }}`
  instead.
- `to` and `duration` are mutually exclusive on `mode: check` and `mode: live` —
  give exactly one. There is deliberately no default for either; a 10-minute
  gate is a choice you make explicitly, not one this action makes for you. With
  `live`, `duration` is measured from the start of the live step, and `to` must
  be in the future.

## Inputs

See [action.yml](action.yml) for the full, authoritative list with defaults. The
ones worth calling out:

| Input                      | Notes                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`                     | `record`, `check`, `live`, or `stop`                                                                                                                                            |
| `alerts`                   | One alert name per line. Required for `record` and `live`; refused for `check`, which reads the set from the recorded log                                                       |
| `from` / `to` / `duration` | `check` and `live`. `from` is when the deploy landed; `to` is when the work ended; `duration` replaces `to` when there is no distinct "done" event (measured from live's start) |
| `fail-on-violation`        | Default `true`. Stops exit 1 only, never exit 2                                                                                                                                 |
| `no-fail-fast`             | Default `false`. `true` waits for the full window even after a certain failure; needs CLI v0.1.2+                                                                               |
| `print-instances-details`  | Default `false`. Lists the failing instances of every bad alert under the summary table and in the PR comment                                                                   |
| `github-token`             | Defaults to `${{ github.token }}`. Used only to upsert the PR comment; needs `pull-requests: write`                                                                             |

## Outputs

`record` sets `log-path` and `pidfile` for transparency; `check` finds them by
convention, so you never need to wire them through yourself. `check` and `live`
set `passed`, `violation-count`, `violations` (JSON), and `outcomes` (JSON, one
`{alert, outcome}` entry per resolved rule).

## Runner requirements

Linux (`ubuntu-*`) and macOS runners, `amd64` or `arm64`. The release provides
no other platform binaries. The action runs on the `node24` runtime, and the
window arithmetic is done in TypeScript, so it works on both OSes.
