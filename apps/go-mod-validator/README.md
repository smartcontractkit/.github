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

## Inputs

1. github-token: token with read permissions on all smartcontractkit repos. By
   default, we use ${{ github.token }}
2. go-mod-dir: Common directory where go.mod files are located. By default, we
   use ${{ github.workspace }}

## Outputs

1. Exits 0, all dependencies are verified as being on the default branch of the
   upstream repositories.
2. Exits 1, if _dependency is not on the default branch_ then please update your
   `go.mod` file to use a dependency that's on the default branch of the
   upstream repository.

## Example usage

```yaml
steps:
  - name: Check out the repository
    uses: actions/checkout
  - name: Setup go
    uses: actions/setup-go
  - name: Validate go.mod
    uses: smartcontractkit/.github/apps/go-mod-validator@<commit> # go-mod-validator@x.y.z
```

This requires users to clone the repo, setup Go using their `go.mod` file and
then call `go-mod-validator`

## Running locally

1. If `go.mod` files are present in the current directory (or any of the child
   directories) - `pnpm run local`
2. If `go.mod` files are present in another directory -
   `pnpm run local --goModDir=/absolute/path/to/gomod/directory`
