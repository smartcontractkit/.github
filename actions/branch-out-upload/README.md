# branch-out-upload

This action is used to:

1. Process JUnit XML reports with
   [junit-enhancer](https://github.com/smartcontractkit/quarantine/tree/main/cmd/junit-enhancer)
2. Upload the result to Trunk

## Inputs

| Input                         | Description                                                                                                               | Required | Default          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- |
| `test-suite-language`         | The language of the test suite. This determines how the junit file is processed.                                          | **Yes**  | `go`             |
| `junit-file-path`             | Path to the JUnit XML file to be processed                                                                                | **Yes**  | `./junit.xml`    |
| `junit-enhancer-version`      | The version of the junit-enhancer to install                                                                              | No       | `latest`         |
| `trunk-org-slug`              | The organization slug for Trunk.io.                                                                                       | **Yes**  | -                |
| `trunk-token`                 | The token for Trunk.io.                                                                                                   | **Yes**  | -                |
| `trunk-upload-only`           | Upload the result to Trunk.io without using the response to determine the outcome. Common during initial repo onboarding. | No       | `false`          |
| `trunk-job-url`               | The URL to the job run.                                                                                                   | **Yes**  | See `action.yml` |
| `trunk-previous-step-outcome` | The outcome of the testing step. Used to determine failure status of this action.                                         | **Yes**  | -                |
| `trunk-variant`               | The variant of the test report. Used to differentiate the same test suite across different environments.                  | No       | -                |

## Usage

```yaml
- name: Upload test results
  uses: smartcontractkit/.github/actions/branch-out-upload@<tag>
  with:
    junit-file-path: "./test-results/junit.xml"
    trunk-org-slug: "your-org"
    trunk-token: ${{ secrets.TRUNK_TOKEN }}
    trunk-previous-step-outcome: ${{ steps.test.outcome }}
```

sdfsdfsdfsdf
