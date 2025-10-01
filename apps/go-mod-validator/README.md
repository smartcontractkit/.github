# go-mod-validator

For all go.mod files within a repository, filtered by a given prefix, this
action validates that each dependency is on the default branch of the upstream
repository.

Requirements:

- Go compiler (version matching your `go.mod` or higher)

## Inputs

- github-token: token with read permissions on all smartcontractkit repos. By
  default, we use ${{ github.token }}
- go-mod-dir: Common directory where go.mod files are located. By default, we
  use ${{ github.workspace }}
- dep-prefix: Prefix to filter dependencies to check. By default, we use
  `github.com/smartcontractkit`

## Outputs

1. Exits 0, all dependencies are verified as being on the default branch of the
   upstream repositories.
2. Exits 1, if a _dependency is not on the default branch_

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

## Running locally

1. Update `scripts/test.sh` and `scripts/payload.json`
2. Make sure to check out your local repo to the proper commit as per
   `payload.json`
3. Run `./apps/go-mod-validator/scripts/test.sh`
