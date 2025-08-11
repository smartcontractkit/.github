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
        uses: smartcontractkit/.github/actions/ci-lint-go@5f5ebd52cb13f4b8530cd3005ec7ec3180840219 # v0.2.5
        with:
          go-version-file: go.mod
```
