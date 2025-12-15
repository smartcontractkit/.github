# ctf-build-image

> Common action for building chainlink test images

## Upgrading to v1

The V1 action has been heavily refactored. If there is some functionality that
has been removed during the refactor, please reach out on `#team-devex`.

Most of the override functionality has been minimally tested in actual CI
environments. If you find something broken, and need support reach out on
`#team-devex`.

### Input Changes

#### Removed

- `should-checkout` - Controlled whether the repo (`cl_repo`) at a certain ref
  (`cl_ref`) should be checked out. You should now check out the repo prior to
  calling this action.
  - `cl_repo` / `cl_ref` - both removed.
- All dependency-specific override inputs have been removed, and functionality
  has been changed.
  - `dep_solana_sha`, `dep_cosmos_sha`, `dep_starknet_sha`, `dep_atlas_sha`,
    `dep_common_sha`, `dep_evm_sha`
  - See `plugin-manifest-overrides`, and `go-get-overrides` below.
- `QA_PRIVATE_GHA_PULL` - This updated the global git config, for authenticating
  to private GH repositories. Update this yourself in your workflow if needed,
  or use the `gati-*` inputs below.
- `GO_COVER_FLAG`
  - This was being passed into the docker build args. Can now be passed in
    through the `docker-additional-build-args` input parameter.
- `GOPRIVATE` - this was being used to pass into specific actions. If needed,
  I'd recommend passing this in as an env to this action, instead.
- `docker_secrets` - this had no active usages AFAICT.

#### Renamed

- `cl_dockerfile` is now `dockerfile`
- `QA_AWS_REGION` is now `aws-region`
- `QA_AWS_ROLE_TO_ASSUME` is now `aws-role-arn`
- `push_tag` is now `image-tag`

#### New

- `plugin-manifest-overrides` - This is a multiline string of `<plugin>=<ref>`
  entries. These will be used to edit the `gitRef` values
  `plugins/plugins.public.yaml` file.
- `go-get-overrides` - This is a multiline string of `<repo>=<ref>` entries.
  These will be used to run `go get github.com/smartcontractkit/<repo>@<ref>`.
- `aws-account-number` - The AWS account of the ECR registry
- `docker-registry-url` - The URL for the registry, typically of the form
  `<account id>.dkr.ecr.<region>.amazonaws.com`
- `docker-repository-name` - The name of the ECR repository. ie. `chainlink`
- `docker-additional-build-args` - A multiline string of additional docker build
  args. See the `build-args` input for
  [`docker/build-push-action`](https://github.com/docker/build-push-action#customizing).
  - `COMMIT_SHA=${{ github.sha }}`, and `CHAINLINK_USER=chainlink` are passed in
    as build args by default.
- `gati-role-arn` - Optional - The ARN of the IAM role capable of calling the
  corresponding GATI lambda.
  - Must be present along with `gati-lambda-url`
- `gati-lambda-url` - The lambda url of the GATI
  - Must be present along with `gati-role-arn`
- `gati-aws-region` - Optional - defaults to `us-west-2`. You should probably
  leave this alone.
- `platform` - Defaults to `linux/amd64`, use `linux/arm64` for arm-based
  runners. Cross-platform builds are not supported.
