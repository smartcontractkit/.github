# go-mod-validator

For all go.mod files within a repository, filtered by a given prefix, this
action validates that each dependency is on the default branch of the upstream
repository.

Requirements:

- Go compiler (version matching your `go.mod` or higher)

## Inputs

- `github-token`: token with read permissions on all smartcontractkit repos.
  Defaults to ${{ github.token }}, which won't have access to private
  repositories.
- `github-pr-read-token`: token with `pull-requests: read` permissions on the
  calling repository. Defaults to the above `github-token` input if not
  provided. This should only be required if the above token is a GATI token for
  reading private dependencies.
- `go-mod-dir`: Common directory where go.mod files are located. Defaults to
  `${{ github.workspace }}`
- `dep-prefix`: Prefix to filter dependencies to check. By default, we use
  `github.com/smartcontractkit`
- `repo-branch-exceptions` - Input allowing exceptions for non-default branches
  on certain repositories.
  - The input is newline delimited, in the format of:
    - `<owner>/<repo>:<branch-1>,<optional branches>`
    - Example: `smartcontractkit/.github:develop`

## Outputs

1. Exits 0, all dependencies are verified as being on the default branch of the
   upstream repositories.
2. Exits 1, if a _dependency is not on the default branch_

## Usage

### Org-wide Workflow

To integrate this into your repository, it is best to use the org-wide workflow.
Ask in `#team-releng` to have it enabled for you. If your repository has private
dependencies, then you will have to configurate the workflow yourself.

Here is the org-wide workflow:
https://github.com/smartcontractkit/gha-org-workflows/blob/main/.github/workflows/go-mod-validation.yml

### Workflow Example

```yaml
permissions:
  contents: read
  pull-requests: read
steps:
  - name: Check out the repository
    uses: actions/checkout@<version>

  - name: Setup go
    uses: actions/setup-go@<version>

  - name: Validate go.mod
    uses: smartcontractkit/.github/apps/go-mod-validator@go-mod-validator/<version>
```

### Workflow Example (private deps)

```yaml
permissions:
  contents: read
  pull-requests: read
  id-token: write
steps:
  - name: Check out the repository
    uses: actions/checkout@<version>

  - name: Setup go
    uses: actions/setup-go@<version>

  - name: Setup-github-token
    id: setup-github-token
    uses: smartcontractkit/.github/actions/setup-github-token@setup-github-token/<version>
    with:
      aws-role-arn: ${{ secrets.<role arn> }}
      aws-lambda-url: ${{ secrets.<lambda url> }}
      aws-region: ${{ secrets.<region> }}
      set-git-config: true

  - name: Validate go.mod
    uses: smartcontractkit/.github/apps/go-mod-validator@go-mod-validator/<version>
    with:
      github-token: ${{ steps.setup-github-token.outputs.access-token }} # GATI token
      github-pr-read-token: ${{ secrets.GITHUB_TOKEN }} # CI-generated token
```

### Running locally

1. Update `scripts/test.sh` and `scripts/payload.json`
2. Make sure to check out your local repo to the proper commit as per
   `payload.json`
3. Run `./apps/go-mod-validator/scripts/test.sh`
