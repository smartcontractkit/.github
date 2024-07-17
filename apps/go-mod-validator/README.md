# go-mod-validator

This action verifies that all upstream dependencies are tested in a given go
package.

Requirements:

1. Go compiler (version matching your `go.mod` or higher)

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

1. Set github token by setting env variable `INPUT_GITHUB_TOKEN`
2. Set directory containing `go.mod` files (also any child directories) by
   setting env var `INPUT_GO_MOD_DIR`, default will be current working directory
3. Run `pnpm run local`
