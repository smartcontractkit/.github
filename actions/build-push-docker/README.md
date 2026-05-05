# build-push-docker

Builds and pushes a single-platform Docker image to ECR. Intended to be paired
with [build-push-docker-manifest](../build-push-docker-manifest) to produce a
multi-platform manifest from per-arch builds.

## Runner requirements

- OS: Linux only
- Architecture: must match the `platform` input (`linux/amd64` → X64 runner,
  `linux/arm64` → ARM64 runner)

## Inputs

| Input                     | Required     | Default                                               | Description                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`                | **yes**      | —                                                     | Target platform, e.g. `linux/amd64` or `linux/arm64`. Must match the runner architecture.                                                                                                                                                                                   |
| `docker-registry-url`     | when pushing | —                                                     | Registry hostname. Examples: `public.ecr.aws`, `<account-id>.dkr.ecr.<region>.amazonaws.com`                                                                                                                                                                                |
| `docker-repository-name`  | when pushing | —                                                     | Repository name excluding the hostname and tags. Public ECR includes a registry alias, e.g. `chainlink/chainlink`. Private ECR is just the repo name, e.g. `my-repo`.                                                                                                       |
| `aws-account-number`      | when pushing | —                                                     | AWS account number for the ECR registry.                                                                                                                                                                                                                                    |
| `aws-role-arn`            | when pushing | —                                                     | AWS role ARN with ECR push permissions.                                                                                                                                                                                                                                     |
| `aws-region`              | no           | `us-east-1`                                           | AWS region. Use `us-east-1` for public ECR.                                                                                                                                                                                                                                 |
| `dockerfile`              | no           | `./Dockerfile`                                        | Path to the Dockerfile.                                                                                                                                                                                                                                                     |
| `context`                 | no           | —                                                     | Docker build context path or URL. Defaults to the Docker buildx default (repo root).                                                                                                                                                                                        |
| `docker-target`           | no           | —                                                     | Target stage in a multi-stage Dockerfile.                                                                                                                                                                                                                                   |
| `docker-build-args`       | no           | —                                                     | Newline-delimited `KEY=VALUE` build arguments passed to `docker buildx build --build-arg`. See [Docker docs](https://docs.docker.com/reference/cli/docker/buildx/build/#build-arg).                                                                                         |
| `docker-build-contexts`   | no           | —                                                     | Additional named build contexts, e.g. `name=path`.                                                                                                                                                                                                                          |
| `docker-push`             | no           | `true`                                                | Push the built image. Set to `false` for a build-only (no push) run.                                                                                                                                                                                                        |
| `tags`                    | no           | `type=sha,prefix=pr=,event=pr` / `type=ref,event=tag` | Tag spec consumed by [docker/metadata-action](https://github.com/docker/metadata-action).                                                                                                                                                                                   |
| `allow-overwrites`        | no           | `true`                                                | When `false`, the action fails before building if any computed tag already exists in ECR. Useful for pseudo-immutability on public ECRs (which don't support native immutability) or as a fast-fail guard on private immutable ECRs. Ignored when `docker-push` is `false`. |
| `docker-restore-cache`    | no           | `false`                                               | Restore the Docker layer cache before building.                                                                                                                                                                                                                             |
| `docker-save-cache`       | no           | `false`                                               | Save the Docker layer cache after building.                                                                                                                                                                                                                                 |
| `docker-build-cache-from` | no           | GHA cache scoped to OS/arch                           | Override the cache source. Effective only when `docker-restore-cache` is `true`.                                                                                                                                                                                            |
| `docker-build-cache-to`   | no           | GHA cache scoped to OS/arch                           | Override the cache destination. Effective only when `docker-save-cache` is `true`.                                                                                                                                                                                          |
| `docker-attestations`     | no           | `true`                                                | Generate SBOM and provenance attestations. See [Docker docs](https://docs.docker.com/build/ci/github-actions/attestations/).                                                                                                                                                |
| `github-token`            | no           | —                                                     | GitHub token mounted as a Docker build secret (`GIT_AUTH_TOKEN`) for builds that fetch private dependencies.                                                                                                                                                                |

### Automatic `CL_AUTO_DOCKER_TAG` build arg

The action always injects a `CL_AUTO_DOCKER_TAG` build argument containing the
first computed tag (with any `-amd64`/`-arm64` suffix stripped). Dockerfiles can
consume it via `ARG CL_AUTO_DOCKER_TAG`. No configuration is needed; existing
`docker-build-args` are preserved.

## Outputs

| Output                          | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `docker-repository-name`        | Echo of the `docker-repository-name` input.        |
| `docker-image-tags`             | Newline-delimited list of all computed image tags. |
| `docker-image-sha-digest-amd64` | Image digest when `platform` is `linux/amd64`.     |
| `docker-image-sha-digest-arm64` | Image digest when `platform` is `linux/arm64`.     |

## Example usage

### This action is intended to be used with the [reusable-docker-build-publish](../../workflows/reusable-docker-build-publish/) workflow.

#### Set the following repo secrets

**NOTE**: _Requires the [gh cli](https://cli.github.com/)._

```shell
# These are used for ECR.
gh secret set AWS_ACCOUNT_ID # example: 123456789012
gh secret set AWS_REGION # example: us-east-1
gh secret set AWS_OIDC_IAM_ROLE_ARN # example: arn:aws:iam::<AWS_ACCOUNT_ID>:role/<ROLE NAME>
```

#### Create a workflow

This will build and push docker images for linux/amd64 AND linux/arm64.

```yaml
name: Docker Build Push Multi-Platform Example
description: Build amd64 and arm64 images and push to ECR.

on:
  workflow_dispatch:
  pull_request:

env:
  # TODO: set this to your ECR name.
  ECR_NAME: releng-test

permissions: {}

jobs:
  init:
    name: init
    permissions:
      contents: read
    runs-on: ubuntu-24.04
    outputs:
      git-short-sha: ${{ steps.git-short-sha.outputs.short-sha }}
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Get Short SHA
        id: git-short-sha
        run: |
          short_sha=$(git rev-parse --short HEAD)
          echo "short-sha=${short_sha}" | tee -a "${GITHUB_OUTPUT}"

  build-publish:
    name: build-publish-${{ matrix.arch }}
    needs: [init]
    permissions:
      contents: read
      id-token: write
    outputs:
      docker-image-sha-digest-amd64:
        ${{ steps.build-core.outputs.docker-image-sha-digest-amd64 }}
      docker-image-sha-digest-arm64:
        ${{ steps.build-core.outputs.docker-image-sha-digest-arm64 }}
    strategy:
      matrix:
        include:
          - runner: ubuntu-24.04
            arch: amd64
          # NOTE: Runner `ubuntu-24.04-arm` not yet supported on private repos.
          - runner: ubuntu-24.04-4cores-16GB-ARM
            arch: arm64
    runs-on: ${{ matrix.runner }}
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Build Docker image
        id: build-core
        uses: smartcontractkit/.github/actions/build-push-docker@build-push-docker/v1
        with:
          # Change this to public.ecr.aws if you are using the public ECR.
          docker-registry-url:
            ${{ format('{0}.dkr.ecr.{1}.amazonaws.com', secrets.AWS_ACCOUNT_ID,
            secrets.AWS_REGION) }}
          docker-repository-name: ${{ env.ECR_NAME }}
          platform: ${{ format('linux/{0}', matrix.arch) }}
          tags: |
            type=sha,suffix=-${{ matrix.arch }},sha=${{ needs.init.outputs.git-short-sha }}
          aws-account-number: ${{ secrets.AWS_ACCOUNT_ID }}
          aws-role-arn: ${{ secrets.AWS_OIDC_IAM_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}
          dockerfile: ./Dockerfile
          context: .
```
