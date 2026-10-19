# ci-grafana-alert-test

## 1.2.0

### Minor Changes

- [#1681](https://github.com/smartcontractkit/.github/pull/1681)
  [`33195c7`](https://github.com/smartcontractkit/.github/commit/33195c7c5e6b86a3cc8037071559cf4baacfd071)
  Thanks [@Tofel](https://github.com/Tofel)! - feat: support datasource-managed
  (Prometheus-flavored) alert rules from grafana-alertcheck v0.1.10, pin the
  action to that release, show each rule's `source` (`grafana` or `datasource`)
  in the summary and in the `outcomes` output, and strip the CLI's redundant
  `rule "<title>": ` prefix from summary details.

  BREAKING: remove the `poll-interval` input — the CLI no longer accepts
  `watch --poll-interval` (v0.1.9), because every rule now polls at half its own
  evaluation interval.

## 1.1.0

### Minor Changes

- [#1673](https://github.com/smartcontractkit/.github/pull/1673)
  [`a1f009c`](https://github.com/smartcontractkit/.github/commit/a1f009c5fc072b3411dd39446c38d3169ad89a84)
  Thanks [@Tofel](https://github.com/Tofel)! - feat: add `mode: live`
  (single-step watch-and-classify, no recorder, `alerts` required,
  `observation_window` measured from the live start) and `mode: stop`
  (idempotent recorder cleanup for `if: always()` that also reports a gate that
  never ran), select alerts by labels (`include-labels`/`exclude-labels`)
  instead of enumerating names in `record` and `live`, add `exclude-alerts` (an
  enumerated list subtracted from the selected set), expose the recorder's
  `until` hard stop, show a ✅/❌/⏸️ status with failing alerts first and an
  early-exit note in the summary, optionally list failing instances, add the
  `fail-fast` input, and upsert the summary as an idempotent pull request
  comment.

  BREAKING: rename the `duration` input to `observation_window` and the
  `no-fail-fast` input to `fail-fast` (now defaulting to `true`); windows longer
  than 5h30m now fail immediately, because GitHub Actions runners can run for at
  most 6h.

## 1.0.1

### Patch Changes

- [#1671](https://github.com/smartcontractkit/.github/pull/1671)
  [`18995c9`](https://github.com/smartcontractkit/.github/commit/18995c9052322600144199b39a7ec932ae8cf3eb)
  Thanks [@erikburt](https://github.com/erikburt)! - chore: update dependencies

## 1.0.0

### Major Changes

- [#1661](https://github.com/smartcontractkit/.github/pull/1661)
  [`bb1dd3c`](https://github.com/smartcontractkit/.github/commit/bb1dd3cab3f2be73e991d782293373fb771137b3)
  Thanks [@Tofel](https://github.com/Tofel)! - feat: first release of Grafana
  Alert check, fix: update distribution of go-conditional-tests
