# build-push-docker

## Example usage

**NOTE**: _This composite workflow is intended to be used in conjunction with
`../cicd-build-docker-manifest-push` which will create a Docker manifest (or
index) of the images created within this composite workflow._

### Set the following repo secrets

**NOTE**: _Requires the [gh cli](https://cli.github.com/)._

```shell
# These are used for ECR.
gh secret set AWS_ACCOUNT_ID # example: 123456789012
gh secret set AWS_REGION # example: us-east-1
gh secret set AWS_OIDC_IAM_ROLE_ARN # example: arn:aws:iam::<AWS_ACCOUNT_ID>:role/<ROLE NAME>
```

### Create a workflow

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
      - uses: actions/checkout@v4
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
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
          fetch-depth: 1
      - name: Build Docker image
        id: build-core
        uses: smartcontractkit/.github/actions/build-push-docker@main # TODO: use version tag.
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
