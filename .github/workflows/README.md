# Workflows

## Run E2E Tests Reusable Workflow

The [E2E Tests Reusable Workflow](./run-e2e-tests.yml) is designed to run any
type of E2E test on GitHub CI, including docker/testcontainers, old K8s tests,
or tests in CRIB in the future.

Our goal is to migrate all workflows to use this reusable workflow for executing
E2E tests. This approach will streamline our CI and allow for the automatic
execution of tests at different stages of the software development process.
Learn more about the advantages of using reusable workflows
[here](https://smartcontract-it.atlassian.net/wiki/spaces/TT/pages/815497220/CI+Workflows+for+E2E+Tests).

**Examples of Core Repo Workflows Utilizing the Reusable Workflow:**

- [Integration Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/integration-tests.yml)
- [Nightly E2E Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/run-nightly-e2e-tests.yml)
- [Selected E2E Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/run-selected-e2e-tests.yml)
- [On-Demand Automation Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/automation-ondemand-tests.yml)
- [CCIP Chaos Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/ccip-chaos-tests.yml)

### E2E Test Configuration on GitHub CI

The `test_path` workflow input is used to provide path the YAML test
configuration file that defines all E2E tests configured for execution on CI.
Each entry specifies the type of GitHub Runner needed and the workflows in which
the test is included.

**Example:**

```yml
- id: smoke/ocr_test.go:*
  path: integration-tests/smoke/ocr_test.go
  test_env_type: docker
  runs_on: ubuntu-latest
  triggers:
    - PR E2E Core Tests
    - Merge Queue E2E Core Tests
    - Nightly E2E Tests
  test_cmd:
    cd integration-tests/ && go test smoke/ocr_test.go -timeout 30m -count=1
    -test.parallel=2 -json
  pyroscope_env: ci-smoke-ocr-evm-simulated
```

**Example of e2e-tests.yml:**
https://github.com/smartcontractkit/chainlink/blob/develop/.github/e2e-tests.yml

### Slack Notification After Tests

To configure Slack notifications after tests executed via the reusable workflow,
follow these steps:

- Set `slack_notification_after_tests` to either `always` or `on_failure`
  depending on when you want notifications to be sent.
- Assign `slack_notification_after_tests_channel_id` to the ID of the Slack
  channel where notifications should be sent.
- Provide a title for the notification by setting
  `slack_notification_after_tests_name`.
- Optionally use `slack_notification_after_tests_notify_user_id_on_failure` to
  reply in the thread and notify a user about the failed workflow

**Example:**

```yml
jobs:
  call-run-e2e-tests-workflow:
    name: Run E2E Tests
    uses: ./.github/workflows/run-e2e-tests-reusable-workflow.yml
    with:
      chainlink_version: develop
      test_trigger: Nightly E2E Tests
      slack_notification_after_tests: true
      slack_notification_after_tests_channel_id: "#team-test-tooling-internal"
      slack_notification_after_tests_name: Nightly E2E Tests
      slack_notification_after_tests_notify_user_id_on_failure: U0XXXXXXX
```

## Guides

### How to Run Custom Tests with Reusable Workflow

To run a specific list of tests, utilize the `custom_test_list_json` input. This
allows you to provide a customized list of tests. If your test list is dynamic,
you can generate it during a preceding job and then reference it using:
`custom_test_list_json: ${{ needs.gen_test_list.outputs.test_list }}`.

```yml
run-e2e-tests-workflow:
  name: Run E2E Tests
  uses: ./.github/workflows/run-e2e-tests-reusable-workflow.yml
  with:
    custom_test_list_json: >
      {
        "tests": [
          {
            "id": "TestVRFv2Plus",
            "path": "integration-tests/smoke/vrfv2plus_test.go",
            "runs_on": "ubuntu-latest",
            "test_env_type": "docker",
            "test_cmd": "cd integration-tests/smoke && go test
      vrfv2plus_test.go"
          }
        ]
      }
```