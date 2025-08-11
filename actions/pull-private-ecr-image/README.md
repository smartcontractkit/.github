# pull-private-ecr-image

This GitHub Composite Action authenticates to a private ECR registry and pulls
the specified Docker image to the local environment.

## Inputs

- **aws-account-number** (required): AWS account number of the ECR.
- **aws-region** (required): AWS region. Example: `us-west-2`.
- **aws-role-arn** (required): ARN of the AWS role to assume with read access to
  the ECR.
- **aws-role-duration-seconds** (optional): Duration for which the role is
  assumed. Default: `"3600"`.
- Image Inputs - choose between:
  1. Specifying repository, and image tag explicitly. Will create the image url
     from the provided `aws-account-number`, `aws-region`, `ecr-repository`, and
     `image-tag`.
     - **ecr-repository** (optional): ECR repository name.
     - **image-tag** (optional): Tag of the image.
  2. The full image url:
     - `image-url` (optional): Full URL of the image. If provided, takes
       precedence over `ecr-repository` and `image-tag`.
     - **Note**: The `aws-account-number` and `aws-region` provided above must
       match the aws account number in the `image-url`

## Outputs

- **image-url**: The URL of the Docker image that was pulled from the ECR.

## Usage

### Using ecr-repository and image-tag

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    ...
      - uses: smartcontractkit/.github/actions/pull-private-ecr-image@<ref>
        with:
          aws-account-number: ${{ secrets.AWS_ACCOUNT_NUMBER }}
          aws-region: ${{ secrets.AWS_REGION }}
          aws-role-arn: ${{ secrets.ECR_READ_ROLE_ARN }}
          ecr-repository: "foo"
          image-tag: "bar"
```

### Using image-url

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    ...
      - uses: smartcontractkit/.github/actions/pull-private-ecr@<ref>
        with:
          aws-account-number: ${{ secrets.AWS_ACCOUNT_NUMBER }}
          aws-region: ${{ secrets.AWS_REGION }}
          aws-role-arn: ${{ secrets.ECR_READ_ROLE_ARN }}
          image-url: "123456789012.dkr.ecr.us-west-2.amazonaws.com/my-repo:latest"
```
