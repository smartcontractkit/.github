# Run E2E Tests

Reusable GitHub Actions workflow for running Chainlink E2E tests across Docker,
remote k8s runner, and in-memory environments.

The tests this is intended to run are now considered "legacy". This is still
in-use but is not actively developed.

## Purpose

This workflow is meant to be called from other workflows via `workflow_call`. It
is not intended to run directly.

In the common path, it uses `citool` to read a configured YAML test definition
file, filter tests based on the provided selection inputs, and generate matrix
JSON for each test environment type. You can add the `citool` reference link
here.

## Security

> [!IMPORTANT] All `workflow_call` inputs may appear in GitHub logs as plain
> text. Do **not** pass sensitive data through inputs.

For test secrets, use:

- the `TEST_SECRETS_OVERRIDE_BASE64` secret, or
- `test_secrets_override_key` with an `aws:` Secrets Manager reference

## What this workflow does

- Validates input combinations
- Optionally checks for tests missing configuration entries
- Loads test definitions from YAML or `custom_test_list_json`
- Generates separate matrices for:
  - Docker tests
  - k8s remote runner tests
  - in-memory tests
- Ensures required Chainlink and plugin images exist in QA ECR
- Builds a remote runner test image for k8s tests when needed
- Runs tests with `ctf-run-tests`
- Uploads logs, traces, coverage, and test result artifacts
- Aggregates all test results into a single workflow output
- Optionally sends Slack notifications after the run

## Inputs

| Input                                                      | Type      |                                                                                             Default | Description                                                                                                       |
| ---------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------- |
| `workflow_name`                                            | `string`  |                                                                                     `Run E2E Tests` | Custom name for the workflow run.                                                                                 |
| `chainlink_version`                                        | `string`  |                                                                                                     | Chainlink version, branch, or commit SHA to use for tests.                                                        |
| `test_path`                                                | `string`  |                                                                                                     | Path to the YAML test configuration file. Usually used by `citool` to generate test matrices.                     |
| `test_ids`                                                 | `string`  |                                                                                                     | Comma-separated test IDs to run. Mutually exclusive with `test_trigger`.                                          |
| `test_list`                                                | `string`  |                                                                                                     | Base64-encoded list of YAML objects specifying tests to run.                                                      |
| `custom_test_list_json`                                    | `string`  |                                                                                                     | Custom JSON list of tests to run instead of loading from the YAML config.                                         |
| `test_trigger`                                             | `string`  |                                                                                                     | Trigger name used to select tests from the YAML config. Mutually exclusive with `test_ids`.                       |
| `test_secrets_override_key`                                | `string`  |                                                                                                     | Secret override key. Use `aws:` prefix for AWS Secrets Manager values.                                            |
| `test_config_override_path`                                | `string`  |                                                                                                     | Path to a test config file that overrides the default test config.                                                |
| `check_test_path`                                          | `string`  |                                                                                                     | Path to a test folder to check for tests missing entries in the YAML config.                                      |
| `with_existing_remote_runner_version`                      | `string`  |                                                                                                     | Existing remote runner image version to reuse for k8s tests.                                                      |
| `test_image_suites`                                        | `string`  | `chaos migration reorg smoke soak benchmark load ccip-tests/load ccip-tests/smoke ccip-tests/chaos` | Space-separated suites to include in the remote runner test image.                                                |
| `require_chainlink_image_versions_in_qa_ecr`               | `string`  |                                                                                                     | Comma-separated Chainlink image versions that must exist in QA ECR; missing versions are built and pushed.        |
| `require_chainlink_plugin_versions_in_qa_ecr`              | `string`  |                                                                                                     | Comma-separated Chainlink plugin image versions that must exist in QA ECR; missing versions are built and pushed. |
| `skip_image_build`                                         | `boolean` |                                                                                             `false` | Skip building the Chainlink image.                                                                                |
| `slack_notification_after_tests`                           | `string`  |                                                                                                     | Slack notification mode. Common values: `always`, `on_failure`.                                                   |
| `slack_notification_after_tests_channel_id`                | `string`  |                                                                                                     | Slack channel ID for post-test notifications.                                                                     |
| `slack_notification_after_tests_name`                      | `string`  |                                                                                                     | Display name used in the Slack notification.                                                                      |
| `slack_notification_after_tests_notify_user_id_on_failure` | `string`  |                                                                                                     | Slack user ID to notify when tests fail.                                                                          |
| `test_log_level`                                           | `string`  |                                                                                             `debug` | Log level for test execution.                                                                                     |
| `upload_cl_node_coverage_artifact`                         | `boolean` |                                                                                             `false` | Upload Chainlink node coverage as a GitHub artifact.                                                              |
| `enable_otel_traces_for_ocr2_plugins`                      | `boolean` |                                                                                             `false` | Enable OpenTelemetry traces for eligible OCR2 plugin tests.                                                       |
| `SLACK_CHANNEL`                                            | `string`  |                                                                                                     | `SLACK_CHANNEL` env var passed into tests for test-side notifications.                                            |
| `SLACK_USER`                                               | `string`  |                                                                                                     | `SLACK_USER` env var passed into tests for test-side notifications.                                               |
| `setup_gap`                                                | `boolean` |                                                                                             `false` | Set up GAP for Grafana.                                                                                           |
| `collect_test_telemetry`                                   | `boolean` |                                                                                             `false` | Collect telemetry data for debugging test resource issues.                                                        |
| `team`                                                     | `string`  |                                                                                                     | Team name for the test run, for example `BIX` or `CCIP`. Required for k8s tests.                                  |
| `use-self-hosted-runners`                                  | `string`  |                                                                                           `"false"` | If `true`, uses `runs_on_self_hosted` from the test config where available. Otherwise uses `runs_on`.             |
| `ecr_name`                                                 | `string`  |                                                                                         `chainlink` | ECR repository name used for test images.                                                                         |
| `quarantine`                                               | `string`  |                                                                                           `"false"` | Enables quarantine / flaky-test handling.                                                                         |
| `test-timeout-minutes`                                     | `number`  |                                                                                                `60` | Overall timeout for each test in minutes.                                                                         |

## Outputs

| Output         | Description                                    |
| -------------- | ---------------------------------------------- |
| `test_results` | JSON array of results from all executed tests. |

## Required secrets

Minimum required secrets for common usage:

- `QA_AWS_REGION`
- `QA_AWS_ROLE_TO_ASSUME`
- `QA_AWS_ACCOUNT_NUMBER`
- `GH_TOKEN`
- `AWS_REGION`

Additional secrets may be required depending on the selected tests and enabled
features, including:

- test secret overrides
- Slack notifications
- Loki / Grafana / Pyroscope integrations
- k8s execution
- GATI token setup
- quarantine reporting

## Typical flow

1. Validate input combinations and secret override rules.
2. Load tests from:
   - configured YAML via `citool`, or
   - `custom_test_list_json`.
3. Generate matrix JSON for Docker, k8s remote runner, and in-memory tests.
4. Build or verify required images.
5. Run tests in parallel by environment type.
6. Upload artifacts and aggregate test results.
7. Optionally send Slack notifications.

## Example Usage

See
[chainlink/.github/worfklows/integration-tests.yml](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/integration-tests.yml#L475-L517).

```yaml
run-core-e2e-tests:
  needs: [run-core-e2e-tests-setup, build-chainlink, changes, labels]
  name: ${{ needs.run-core-e2e-tests-setup.outputs.workflow-name }}
  permissions:
    actions: read
    checks: write
    pull-requests: write
    id-token: write
    contents: read
  if: needs.run-core-e2e-tests-setup.outputs.should-run == 'true'
  uses: smartcontractkit/.github/.github/workflows/run-e2e-tests.yml@<ref>
  with:
    workflow_name: ${{ needs.run-core-e2e-tests-setup.outputs.workflow-name }}
    chainlink_version: ${{ inputs.evm-ref || inputs.cl_ref || github.sha }}
    test_path: .github/e2e-tests.yml
    test_trigger: ${{ needs.run-core-e2e-tests-setup.outputs.test-trigger }}
    upload_cl_node_coverage_artifact: true
    enable_otel_traces_for_ocr2_plugins:
      ${{ contains(join(github.event.pull_request.labels.*.name, ' '), 'enable
      tracing') }}
    use-self-hosted-runners:
      ${{ needs.labels.outputs.should-use-self-hosted-runners }}
    ecr_name: ${{ inputs.ecr_name || 'chainlink-integration-tests' }}
    quarantine: "true"
  secrets:
    QA_AWS_REGION: ${{ secrets.QA_AWS_REGION }}
    QA_AWS_ROLE_TO_ASSUME: ${{ secrets.QA_AWS_ROLE_TO_ASSUME }}
    QA_AWS_ACCOUNT_NUMBER: ${{ secrets.QA_AWS_ACCOUNT_NUMBER }}
    PROD_AWS_ACCOUNT_NUMBER: ${{ secrets.AWS_ACCOUNT_ID_PROD }}
    QA_PYROSCOPE_INSTANCE: ${{ secrets.QA_PYROSCOPE_INSTANCE }}
    QA_PYROSCOPE_KEY: ${{ secrets.QA_PYROSCOPE_KEY }}
    GRAFANA_INTERNAL_TENANT_ID: ${{ secrets.GRAFANA_INTERNAL_TENANT_ID }}
    GRAFANA_INTERNAL_BASIC_AUTH: ${{ secrets.GRAFANA_INTERNAL_BASIC_AUTH }}
    GRAFANA_INTERNAL_HOST: ${{ secrets.GRAFANA_INTERNAL_HOST }}
    GRAFANA_INTERNAL_URL_SHORTENER_TOKEN:
      ${{ secrets.GRAFANA_INTERNAL_URL_SHORTENER_TOKEN }}
    LOKI_TENANT_ID: ${{ secrets.LOKI_TENANT_ID }}
    LOKI_URL: ${{ secrets.LOKI_URL }}
    LOKI_BASIC_AUTH: ${{ secrets.LOKI_BASIC_AUTH }}
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    AWS_REGION: ${{ secrets.QA_AWS_REGION }}
    AWS_OIDC_IAM_ROLE_VALIDATION_PROD_ARN:
      ${{ secrets.AWS_OIDC_IAM_ROLE_VALIDATION_PROD_ARN }}
    AWS_API_GW_HOST_GRAFANA: ${{ secrets.AWS_API_GW_HOST_GRAFANA }}
    SLACK_BOT_TOKEN: ${{ secrets.QA_SLACK_API_KEY }}
    OPTIONAL_GATI_AWS_ROLE_ARN:
      ${{ secrets.AWS_OIDC_CHAINLINK_READ_ONLY_TOKEN_ISSUER_ROLE_ARN }}
    OPTIONAL_GATI_LAMBDA_URL:
      ${{  secrets.AWS_INFRA_RELENG_TOKEN_ISSUER_LAMBDA_URL}}
    TRUNK_API_KEY: ${{ secrets.TRUNK_API_KEY }}
```
