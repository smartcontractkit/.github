# ci-sonarqube-ts

> Add SonarQube for Typescript to CI

## Example

```yaml
sonarqube:
  name: SonarQube Scan
  needs: [wait_for_workflows]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: SonarQube Scan
      uses: smartcontractkit/.github/actions/ci-sonarqube-go@dca9ab89d734e82738b8aa52bd25d09b205ec6ee # v0.1.1
      with:
        # sonarqube inputs
        include-lint: "true"
        test-report-workflow: "ci-core.yaml"
        lint-report-workflow: "ts-lint.yaml"
        sonar-token: ${{ secrets.SONAR_TOKEN }}
        sonar-host-url: ${{ secrets.SONAR_HOST_URL }}
```
