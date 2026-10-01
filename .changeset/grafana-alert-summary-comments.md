---
"ci-grafana-alert-test": minor
---

feat: add `mode: live` (single-step watch-and-classify, no recorder, `alerts`
required, `observation_window` measured from the live start) and `mode: stop`
(idempotent recorder cleanup for `if: always()` that also reports a gate that
never ran), select alerts by labels (`include-labels`/`exclude-labels`) instead
of enumerating names in `record` and `live`, add `exclude-alerts` (an enumerated
list subtracted from the selected set), expose the recorder's `until` hard stop,
show a ✅/❌/⏸️ status with failing alerts first and an early-exit note in
the summary, optionally list failing instances, add the `fail-fast` input,
and upsert the summary as an idempotent pull request comment.

BREAKING: rename the `duration` input to `observation_window` and the
`no-fail-fast` input to `fail-fast` (now defaulting to `true`); windows longer
than 5h30m now fail immediately, because GitHub Actions runners can run for at
most 6h.
