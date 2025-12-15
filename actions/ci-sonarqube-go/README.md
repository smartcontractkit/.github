# ci-sonarqube-go

> Add SonarQube for Golang to CI

## Example

```yaml
sonarqube:
  name: SonarQube Scan
  needs: [wait_for_workflows]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: SonarQube Scan
      uses: smartcontractkit/.github/actions/ci-sonarqube-go@<latest commit> # v0.2.0
      with:
        # sonarqube inputs
        include-lint: "true"
        # if workflow names are not used, artifacts will be downloaded
        # from a workflow this action is added to
        test-report-workflow: "ci-core.yaml" # optional
        lint-report-workflow: "golingci-lint.yaml" # optional
        sonar-token: ${{ secrets.SONAR_TOKEN }}
        sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
```
