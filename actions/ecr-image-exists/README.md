# ecr-image-exists

Checks whether one or more Docker image tags exist in ECR (public or private).
Supports optional AWS credential configuration and registry login within the
action, or can operate against credentials already present in the environment.

## Inputs

| Input                       | Required | Default     | Description                                                                                                                                                           |
| --------------------------- | -------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-registry-url`       | **yes**  | —           | Registry URL. For public ECR, include the registry alias (e.g. `public.ecr.aws/chainlink`). For private ECR: `<account-id>.dkr.ecr.<region>.amazonaws.com`.           |
| `docker-repository-name`    | **yes**  | —           | Repository name only — no hostname, no alias, no tags (e.g. `chainlink`).                                                                                             |
| `tags`                      | **yes**  | —           | Newline-delimited list of tags to check. At least one non-empty tag is required.                                                                                      |
| `assert-non-existence`      | no       | `false`     | When `true`, the action fails if any of the provided tags already exist in ECR.                                                                                       |
| `registry-auth`             | no       | `false`     | When `true`, logs in to the private ECR registry inside this action. Ignored for public ECR. Set to `false` when registry auth is already configured in a prior step. |
| `aws-region`                | no       | `us-east-1` | AWS region. Use `us-east-1` for public ECR.                                                                                                                           |
| `aws-role-arn`              | no       | —           | AWS role ARN to assume before checking tags. If omitted, uses the AWS credentials already present in the environment.                                                 |
| `aws-role-duration-seconds` | no       | `3600`      | Session duration when assuming `aws-role-arn`.                                                                                                                        |

## Outputs

| Output   | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| `exists` | `true` if any of the provided tags exist in ECR, `false` otherwise. |

## Usage

### Skip a build when the image already exists

```yaml
- name: Check if image exists
  id: check-image
  uses: smartcontractkit/.github/actions/ecr-image-exists@<sha> # ecr-image-exists@x.y.z
  with:
    docker-registry-url: ${{ format('{0}.dkr.ecr.{1}.amazonaws.com', secrets.AWS_ACCOUNT_ID, secrets.AWS_REGION) }}
    docker-repository-name: chainlink
    tags: ${{ needs.init.outputs.git-short-sha }}
    aws-role-arn: ${{ secrets.AWS_ECR_READ_ONLY_ROLE }}

- name: Build Image
  if: steps.check-image.outputs.exists != 'true'
  ...
```

### Fail if a tag already exists (assert uniqueness)

```yaml
- name: Assert tag does not exist
  uses: smartcontractkit/.github/actions/ecr-image-exists@<sha> # ecr-image-exists@x.y.z
  with:
    docker-registry-url: public.ecr.aws/chainlink
    docker-repository-name: chainlink
    tags: |
      v1.2.3
      v1.2.3-amd64
    assert-non-existence: "true"
    aws-role-arn: ${{ secrets.AWS_ECR_READ_ONLY_ROLE }}
```

### Using pre-configured AWS credentials

When AWS credentials are already configured by a prior step, omit `aws-role-arn`
and set `registry-auth: "false"` (the default):

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1

- name: Check if image exists
  id: check-image
  uses: smartcontractkit/.github/actions/ecr-image-exists@<sha> # ecr-image-exists@x.y.z
  with:
    docker-registry-url: public.ecr.aws/chainlink
    docker-repository-name: chainlink
    tags: v1.2.3
```

## Migration: v0.2.0 → v1

v1 replaces the original imported interface with inputs that are consistent with
the rest of the `build-push-docker` action family. All three input renames are
breaking changes.

### Breaking input changes

| v0.2.0       | v1                       | Notes                                                       |
| ------------ | ------------------------ | ----------------------------------------------------------- |
| `repository` | `docker-repository-name` | Rename only.                                                |
| `tag`        | `tags`                   | Renamed and now accepts multiple newline-delimited tags.    |
| _(implicit)_ | `docker-registry-url`    | **New required input.** Specify the full registry hostname. |

### Before (v0.2.0)

```yaml
- uses: smartcontractkit/.github/actions/ecr-image-exists@v0
  with:
    repository: chainlink
    tag: "v0.0.1"
    aws-role-arn: ${{ secrets.AWS_ECR_READ_ONLY_ROLE }}
```

### After (v1)

```yaml
- uses: smartcontractkit/.github/actions/ecr-image-exists@v1
  with:
    docker-registry-url:
      ${{ format('{0}.dkr.ecr.{1}.amazonaws.com', secrets.AWS_ACCOUNT_ID,
      secrets.AWS_REGION) }}
    docker-repository-name: chainlink
    tags: "v0.0.1"
    aws-role-arn: ${{ secrets.AWS_ECR_READ_ONLY_ROLE }}
```
