# branch-out-run-and-upload

This action is an extension of [branch-out-upload](../branch-out-upload/) that also runs the tests before the upload. This helps keep things concise for more common scenarios.

## Usage

```yaml
- name: Run and Upload Test Results
  uses: smartcontractkit/.github/actions/branch-out-run-and-upload@<tag>
  with:
    go-test-args: "./... -cover -coverprofile=coverage.txt"
    trunk-org-slug: "your-org"
    trunk-token: ${{ secrets.TRUNK_TOKEN }}
    trunk-previous-step-outcome: ${{ steps.test.outcome }}
```
