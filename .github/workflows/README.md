# Run E2E Tests Reusable Workflow

The [E2E Tests Reusable Workflow](./run-e2e-tests.yml) is designed to run any
type of E2E test on GitHub CI, including docker/testcontainers, old K8s tests,
or tests in CRIB in the future.

Our goal is to migrate all workflows to use this reusable workflow for executing
E2E tests. This approach will streamline our CI and allow for the automatic
execution of tests at different stages of the software development process.
Learn more about the advantages of using reusable workflows
[here](https://smartcontract-it.atlassian.net/wiki/spaces/TT/pages/815497220/CI+Workflows+for+E2E+Tests).

## Examples of Core Repo Workflows Utilizing the Reusable Workflow

- [Integration Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/integration-tests.yml)
- [Nightly E2E Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/run-nightly-e2e-tests.yml)
- [Selected E2E Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/run-selected-e2e-tests.yml)
- [On-Demand Automation Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/automation-ondemand-tests.yml)
- [CCIP Chaos Tests](https://github.com/smartcontractkit/chainlink/blob/develop/.github/workflows/ccip-chaos-tests.yml)

## E2E Test Configuration for Github CI

The `test_path` workflow input is used to provide path the YAML test
configuration file that defines all E2E tests configured for execution on CI.

```yml
jobs:
  run-e2e-tests-workflow:
    name: Run E2E Tests
    uses: smartcontractkit/.github/.github/workflows/run-e2e-tests.yml@aad83f232743646faa35f5ac03ee3829148d37ce
    with:
      test_path: .github/e2e-tests.yml
      test_ids: testA,testB # Tests to run from e2e-tests.yml
```

### Understanding the `e2e-tests.yml` Configuration File

The `e2e-tests.yml` file is a centralized configuration used to specify
environment settings, test commands, and runner specifications for E2E tests in
various GitHub workflows. Here's a breakdown of the components of this
configuration file:

- **ID (`id`)**: A unique identifier for each test entry, potentially using a
  wildcard (\*) to denote a suite of tests.
- **Path (`path`)**: The file system path to the test files, indicating where
  the tests are located within the project.
- **Test Environment Type (`test_env_type`)**: Specifies the environment in
  which the tests will run. Can be `docker` or `k8s-remote-runner`.
- **Runs On (`runs_on`)**: Specifies the GitHub runner that the tests will
  execute on, such as `ubuntu-latest`.
- **Triggers (`triggers`)**: A list of events that trigger the execution of the
  tests. This could include actions like PR (Pull Request) merges, specific
  branches being updated, or scheduled events like nightly builds.
- **Test Command (`test_cmd`)**: The exact command line to execute the tests,
  detailing paths, flags, and parameters necessary to run the tests.
- **Test Environment Variables (`test_env_vars`)**: A set of environment
  variables specific to the test environment that can be used to customize or
  configure the test execution environment dynamically.
- **Test Command Options (`test_cmd_opts`)**: (optional) Custom command line
  options that can be passed to the test command.
- **Pyroscope Environment (`pyroscope_env`)**: (optional) Field for setting a
  specific Pyroscope environment to enable performance monitoring during test
  execution.

**Example for a Docker Test**:

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

**Example for a Kubernetes Test Using Remote Runner**:

```yml
- id: soak/ocr_test.go:TestOCRv1Soak
  path: integration-tests/soak/ocr_test.go
  test_env_type: k8s-remote-runner
  runs_on: ubuntu-latest
  test_cmd:
    cd integration-tests/ && go test soak/ocr_test.go -v -test.run
    ^TestOCRv1Soak$ -test.parallel=1 -timeout 900h -count=1 -json
  test_cmd_opts:
    2>&1 | tee /tmp/gotest.log | gotestloghelper -ci -singlepackage
    -hidepassingtests=false
  test_env_vars:
    TEST_SUITE: soak
```

**Full example of e2e-tests.yml:**
https://github.com/smartcontractkit/chainlink/blob/develop/.github/e2e-tests.yml

## Slack Notification After Tests

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
    uses: smartcontractkit/.github/.github/workflows/run-e2e-tests.yml@aad83f232743646faa35f5ac03ee3829148d37ce
    with:
      chainlink_version: develop
      test_trigger: Nightly E2E Tests
      slack_notification_after_tests: always
      slack_notification_after_tests_channel_id: "#team-test-tooling-internal"
      slack_notification_after_tests_name: Nightly E2E Tests
      slack_notification_after_tests_notify_user_id_on_failure: U0XXXXXXX
```

## Guides

### Integrating the Reusable Workflow in a New Repository

To integrate and utilize the E2E Tests Reusable Workflow in a new repository,
follow these simple steps:

1. **Create a Workflow File**: In your repository, create a new GitHub workflow
   file under `.github/workflows/`.
2. **Set Up the Reusable Workflow**: Utilize the E2E Tests Reusable Workflow to
   run your E2E tests. Below is an example of how to configure this in your
   workflow file:

   ```yml
   jobs:
     run-e2e-tests-workflow:
       name: Run E2E Tests
       uses: smartcontractkit/.github/.github/workflows/run-e2e-tests.yml@aad83f232743646faa35f5ac03ee3829148d37ce
       with:
         # Path to the e2e-tests.yml configuration file in your repository
         test_path: .github/e2e-tests.yml
         # Specify the test ids to run from e2e-tests.yml
         test_ids: testA,testB
         # Chainlink version to use
         chainlink_version: develop
         # ...
         # See more inputs in the workflow definition (run-e2e-tests.yml)
         #
       # GitHub Secrets to be passed to the E2E Tests Workflow
       secrets:
         QA_AWS_REGION: ${{ secrets.QA_AWS_REGION }}
         QA_AWS_ROLE_TO_ASSUME: ${{ secrets.QA_AWS_ROLE_TO_ASSUME }}
         QA_AWS_ACCOUNT_NUMBER: ${{ secrets.QA_AWS_ACCOUNT_NUMBER }}
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
         main-dns-zone: ${{ secrets.MAIN_DNS_ZONE_PUBLIC_SDLC }}
         k8s-cluster-name: ${{ secrets.AWS_K8S_CLUSTER_NAME_SDLC }}
   ```

3. **See Real Examples**: For practical insights and better understanding, refer
   to real-world applications of this setup in the
   [Examples of Core Repo Workflows Utilizing the Reusable Workflow](https://github.com/smartcontractkit/.github/blob/main/.github/workflows/README.md#examples-of-core-repo-workflows-utilizing-the-reusable-workflow).

### Overriding Default Values in the `e2e-tests.yml` Configuration File

If you need to modify default values specified in the `e2e-tests.yml` file
before executing tests, you can use the `test_list` workflow input. This
approach allows you to override settings such as `E2E_TEST_CHAINLINK_IMAGE` and
`E2E_TEST_CHAINLINK_VERSION` specifically for the tests defined in
`e2e-tests.yml`. Below is an example of a workflow that uses the `test_list`
input to provide an updated list of tests for execution by the E2E Tests
Reusable Workflow:

```yml
name: My custom workflow

on:
  workflow_dispatch:
    inputs:
      # List of custom inputs

jobs:
  # Set tests to run based on the "My custom workflow" inputs
  set-tests-to-run:
    name: Set tests to run
    runs-on: ubuntu-latest
    outputs:
      test_list: ${{ steps.set-tests.outputs.test_list }}
    steps:
      - name: Set tests to run
        id: set-tests
        run: |

          cat > test_list.yaml <<EOF
          - id: smoke/automation_upgrade_test.go:^TestAutomationNodeUpgrade/registry_2_0
            test_env_vars:
              E2E_TEST_CHAINLINK_IMAGE: ${{ env.image }}
              E2E_TEST_CHAINLINK_VERSION: ${{ env.version }}

          - id: smoke/automation_upgrade_test.go:^TestAutomationNodeUpgrade/registry_2_1
            test_env_vars:
              E2E_TEST_CHAINLINK_IMAGE: ${{ env.image }}
              E2E_TEST_CHAINLINK_VERSION: ${{ env.version }}

          - id: smoke/automation_upgrade_test.go:^TestAutomationNodeUpgrade/registry_2_2
            test_env_vars:
              E2E_TEST_CHAINLINK_IMAGE: ${{ env.image }}
              E2E_TEST_CHAINLINK_VERSION: ${{ env.version }}
          EOF

          echo "test_list=$(cat test_list.yaml | base64 -w 0)" >> $GITHUB_OUTPUT

  run-e2e-tests:
    name: Run E2E Tests
    needs: set-tests-to-run
    uses: smartcontractkit/.github/.github/workflows/run-e2e-tests.yml@aad83f232743646faa35f5ac03ee3829148d37ce
    with:
      test_path:
        .github/e2e-tests.yml
        # Base64-encoded list specifying the tests to run
      test_list: ${{ needs.set-tests-to-run.outputs.test_list }}
    secrets:
      # GitHub Secrets to be passed to the E2E Tests Workflow
```
