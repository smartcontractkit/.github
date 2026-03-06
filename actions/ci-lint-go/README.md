# ci-lint-go

Example:

```yaml
name: Golangci-lint

on: [pull_request]

jobs:
  golangci-lint:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      actions: read
    steps:
      - name: golangci-lint
        uses: smartcontractkit/.github/actions/ci-lint-go@ci-lint-go/v4
        with:
          go-version-file: go.mod
```
