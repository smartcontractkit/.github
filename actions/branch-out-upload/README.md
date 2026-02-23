# branch-out-upload

This action is used to:

1. Optionally run the tests for you.
2. Process JUnit XML reports with
   [junit-enhancer](https://github.com/smartcontractkit/quarantine/tree/main/cmd/junit-enhancer)
3. Upload the result to Trunk
4. Pass or fail CI

## Inputs

| Input                         | Description                                                                                                                | Required | Default          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| `test-suite-language`         | The language of the test suite. This determines how the junit file is processed.                                           | **Yes**  | `go`             |
| `junit-file-path`             | Path to the JUnit XML file to be processed                                                                                 | **Yes**  | `./junit.xml`    |
| `junit-enhancer-version`      | The version of the junit-enhancer to install                                                                               | No       | `latest`         |
| `go-test-args`                | Arguments to pass to `go test`. When set, this action runs the tests and generates JUnit.                                  | No       | `""`             |
| `trunk-org-slug`              | The organization slug for Trunk.io.                                                                                        | **Yes**  | -                |
| `trunk-token`                 | The token for Trunk.io.                                                                                                    | **Yes**  | -                |
| `trunk-upload-only`           | Upload the result to Trunk.io without using the response to determine the outcome. Common during initial repo onboarding.  | No       | `false`          |
| `trunk-job-url`               | The URL to the job run.                                                                                                    | **Yes**  | See `action.yml` |
| `trunk-previous-step-outcome` | The outcome of the testing step. Used to determine failure status of this action. Required when `go-test-args` is not set. | No       | `""`             |
| `trunk-variant`               | The variant of the test report. Used to differentiate the same test suite across different environments.                   | No       | -                |

## Usage

### Run and Upload

A more streamlined approach for most use cases that keeps things concise. Will
run your go tests, upload the results, and appropriately handle failing or
passing your CI.

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-go@v6

- name: Run Go tests with flake protection
  uses: smartcontractkit/.github/actions/branch-out-upload@<tag>
  with:
    go-test-args: "./... -cover" # Every arg you would list after `go test`
    trunk-org-slug: "your-org"
    trunk-token: ${{ secrets.TRUNK_TOKEN }}
```

### Only Upload

This will only upload test results to branch-out and Trunk. It's meant if you
want to customize your

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-go@v6

- name: Install gotestsum # gotestsum lets us save test results as junit files
  run: go install gotest.tools/gotestsum@latest

- name: Run Tests
  run: gotestsum --format github-actions --junitfile ./test-results/junit.xml --
    ./... -cover # Run tests with gotestsum to get a junit style results file
  id: run-tests # Needed to get results to next step
  continue-on-error: true # Necessary to make sure we upload results. The next step will decide if we should fail the workflow or not.

- name: Upload test results
  uses: smartcontractkit/.github/actions/branch-out-upload@<tag>
  with:
    junit-file-path: "./test-results/junit.xml"
    trunk-org-slug: "your-org"
    trunk-token: ${{ secrets.TRUNK_TOKEN }}
    trunk-previous-step-outcome: ${{ steps.test.outcome }}
```
