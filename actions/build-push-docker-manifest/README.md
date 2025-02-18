# build-push-docker-manifest

## Example usage

Reusable composite workflow to create docker manifest for multi-platform. Use
this after the [`build-push-docker`](../build-push-docker/) composite workflow
to create and push the manifest which will be an index of the image(s) from the
[`build-push-docker`](../build-push-docker/) composite workflow.

### Set the following repo secrets

**NOTE**: _Requires the [gh cli](https://cli.github.com/)._

```shell
# These are used for ECR.
gh secret set AWS_ACCOUNT_ID # example: 123456789012
gh secret set AWS_REGION # example: us-east-1
gh secret set AWS_OIDC_IAM_ROLE_ARN # example: arn:aws:iam::<AWS_ACCOUNT_ID>:role/<ROLE NAME>
```

### Create a workflow

```yaml
name: Docker Build Push Manifest Example
description: Build manifest linking amd64 and arm64 images and push to ECR.

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
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Get Short SHA
        id: git-short-sha
        run: |
          short_sha=$(git rev-parse --short HEAD)
          echo "short-sha=${short_sha}" | tee -a "${GITHUB_OUTPUT}"

  # Creates a linux/amd64 and linux/arm64 image and publishes to ECR.
  # Creates SBOM and provenance.
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
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Build Docker image
        id: build-core
        uses: smartcontractkit/.github/actions/build-push-docker@<sha> # build-push-docker@x.y.z
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

  # Takes the image digests from the build-publish job and creates a manifest linking the two images together.
  # Signs the image manifest.
  docker-manifest:
    name: docker-manifest
    needs: [init, build-publish]
    permissions:
      contents: read
      id-token: write
    runs-on: ubuntu-24.04
    steps:
      - uses: smartcontractkit/.github/actions/build-push-docker-manifest@<sha> # build-push-docker-manifest@x.y.z
        with:
          cosign-oidc-identity:
            ${{ format('https://github.com/{0}', github.workflow_ref) }}
          docker-registry-url:
            ${{ format('{0}.dkr.ecr.{1}.amazonaws.com', secrets.AWS_ACCOUNT_ID,
            secrets.AWS_REGION) }}
          docker-repository-name: ${{ env.ECR_NAME }}
          docker-manifest-sign: true
          docker-manifest-tag:
            ${{ env.DOCKER_TAG_PREFIX }}-${{ needs.init.outputs.git-short-sha }}
          # Comma separated list of image digests to include in the manifest.
          docker-image-name-digests: >-
            ${{
              format(
                '{0},{1}',
                needs.build-publish.outputs.docker-image-sha-digest-amd64,
                needs.build-publish.outputs.docker-image-sha-digest-arm64
              )
            }}
          aws-account-number: ${{ secrets.AWS_ACCOUNT_ID }}
          aws-role-arn: ${{ secrets.AWS_OIDC_IAM_ROLE_ARN }}
          aws-region: ${{ secrets.AWS_REGION }}
```
