# go-mod-validator

This action verifies that all upstream dependencies are tested in a given go
package.

Requirements:

1. Go compiler (version matching go.mod or higher)
2. jq - https://jqlang.github.io/jq/ (available by default in most linux
   distributions)

Validations implemented so far,

1. Finds all `go.mod` files recursively and verifies dependencies are present in
   the default branch of the upstream dependency's repositories

## Example usage

```yaml
steps:
  - name: Check out the repository
    uses: actions/checkout
  - name: Setup go
    uses: actions/setup-go
  - name: go-mod-validation
    uses: smartcontractkit/.github/apps/go-mod-validator
```

This requires users to clone the repo, setup Go using their `go.mod` file and
then call `go-mod-validator`
