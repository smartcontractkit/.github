---
"ci-grafana-alert-test": minor
---

feat: add `mode: live` (single-step watch-and-classify, no recorder, `alerts`
required, `duration` measured from the live start) and `mode: stop` (idempotent
recorder cleanup for `if: always()` that also reports a gate that never ran),
select alerts by labels (`include-labels`/`exclude-labels`) instead of enumerating
names in `record` and `live`, expose the recorder's `until` hard stop, show a
✅/❌ status and an early-exit note in the summary, optionally list failing
instances, add the `no-fail-fast` input, and upsert the summary as an idempotent
pull request comment
