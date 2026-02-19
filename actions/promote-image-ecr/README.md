# Promote Image ECR Action

Promote Docker images from one Amazon ECR registry to another using
[cosign](https://github.com/sigstore/cosign). The action assumes the provided
IAM roles to access both source and destination registries. Cosign is used for
image promotion and signature/attestation copying.

## Features

- Copy images between ECR registries in the same or different AWS regions
- **Copy signatures and attestations using cosign**
- Support for single image promotion
- Support for multiple images using matrix configuration
- Multi-arch manifest support (automatically included with cosign)
- Secure credential handling via AWS role assumption
- Automatic promotion summary on GitHub Actions summary page
- Artifact upload with detailed promotion results (Markdown and JSON)

## Prerequisites

- AWS IAM roles with appropriate ECR permissions:
  - Source role: ECR read permissions (`ecr:GetAuthorizationToken`,
    `ecr:BatchGetImage`, etc.)
  - Destination role: ECR write permissions (`ecr:GetAuthorizationToken`,
    `ecr:PutImage`, etc.)
- OIDC configuration for GitHub Actions to assume AWS roles

## Inputs

| Input                    | Description                                                                                                         | Required |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------- |
| `aws-region`             | AWS region for both registries. Use `source-aws-region` and `destination-aws-region` for different regions instead. | No       |
| `source-aws-region`      | AWS region for source registry. Example: `eu-west-1`. Falls back to `aws-region` if not provided.                   | No\*     |
| `destination-aws-region` | AWS region for destination registry. Example: `us-east-1`. Falls back to `aws-region` if not provided.              | No\*     |
| `source-role-arn`        | IAM Role ARN to assume in SOURCE account (needs ECR read permissions)                                               | Yes      |
| `destination-role-arn`   | IAM Role ARN to assume in DEST account (needs ECR write permissions)                                                | Yes      |

\*At least one of `aws-region`, `source-aws-region`, or `destination-aws-region`
must be provided.

| Input                    | Description                                                                                   | Required |
| ------------------------ | --------------------------------------------------------------------------------------------- | -------- |
| `source-registry`        | Source registry host, e.g. `111111111111.dkr.ecr.eu-west-1.amazonaws.com`                     | Yes      |
| `destination-registry`   | Destination registry host, e.g. `222222222222.dkr.ecr.eu-west-1.amazonaws.com`                | Yes      |
| `source-repository`      | Source repository name, e.g. `my-app` (not required if using `images` matrix)                 | No       |
| `destination-repository` | Destination repository name, e.g. `my-app` (not required if using `images` matrix)            | No       |
| `source-tag`             | Source tag (or digest if you use `@sha256:...`) (not required if using `images` matrix)       | No       |
| `destination-tag`        | Destination tag (not required if using `images` matrix)                                       | No       |
| `images`                 | JSON array of images to promote. Takes precedence over individual inputs. See examples below. | No       |

## Outputs

| Output            | Description                                                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promoted-images` | JSON array of promoted images with their source and destination details, promotion duration, and status. Example: `[{"source_repository": "app1", "source_tag": "v1.0.0", "destination_repository": "app1", "destination_tag": "v1.0.0", "duration_seconds": "12", "status": "success"}]` |

## Usage

### Single Image Promotion

```yaml
name: Promote Image
on:
  workflow_dispatch:

jobs:
  promote:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Promote image
        uses: ./.github/actions/promote-image
        with:
          source_aws_region: eu-west-1
          destination_aws_region: us-east-1
          source_role_arn: arn:aws:iam::111111111111:role/github-actions-ecr-read
          destination_role_arn: arn:aws:iam::222222222222:role/github-actions-ecr-write
          source_registry: 111111111111.dkr.ecr.eu-west-1.amazonaws.com
          destination_registry: 222222222222.dkr.ecr.us-east-1.amazonaws.com
          source_repository: my-app
          destination_repository: my-app
          source_tag: v1.0.0
          destination_tag: v1.0.0
```

### Multiple Images Promotion (Matrix)

```yaml
name: Promote Multiple Images
on:
  workflow_dispatch:

jobs:
  promote:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Promote multiple images
        uses: ./.github/actions/promote-image
        with:
          source_aws_region: eu-west-1
          destination_aws_region: us-east-1
          source_role_arn: arn:aws:iam::111111111111:role/github-actions-ecr-read
          destination_role_arn: arn:aws:iam::222222222222:role/github-actions-ecr-write
          source_registry: 111111111111.dkr.ecr.eu-west-1.amazonaws.com
          destination_registry: 222222222222.dkr.ecr.us-east-1.amazonaws.com
          images: |
            [
              {
                "source_repository": "app1",
                "destination_repository": "app1",
                "source_tag": "v1.0.0",
                "destination_tag": "v1.0.0"
              },
              {
                "source_repository": "app2",
                "destination_repository": "app2",
                "source_tag": "v2.0.0",
                "destination_tag": "v2.0.0"
              },
              {
                "source_repository": "service-x",
                "destination_repository": "service-x",
                "source_tag": "sha-abc123",
                "destination_tag": "production"
              }
            ]
```

### Using with GitHub Matrix Strategy

You can also use GitHub's matrix strategy to run promotions in parallel:

```yaml
name: Promote Images in Parallel
on:
  workflow_dispatch:

jobs:
  promote:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    strategy:
      matrix:
        image:
          - { repo: "app1", tag: "v1.0.0" }
          - { repo: "app2", tag: "v2.0.0" }
          - { repo: "service-x", tag: "sha-abc123" }
    steps:
      - uses: actions/checkout@v4

      - name: Promote ${{ matrix.image.repo }}
        uses: ./.github/actions/promote-image
        with:
          source_aws_region: eu-west-1
          destination_aws_region: us-east-1
          source_role_arn: arn:aws:iam::111111111111:role/github-actions-ecr-read
          destination_role_arn: arn:aws:iam::222222222222:role/github-actions-ecr-write
          source_registry: 111111111111.dkr.ecr.eu-west-1.amazonaws.com
          destination_registry: 222222222222.dkr.ecr.us-east-1.amazonaws.com
          source_repository: ${{ matrix.image.repo }}
          destination_repository: ${{ matrix.image.repo }}
          source_tag: ${{ matrix.image.tag }}
          destination_tag: ${{ matrix.image.tag }}
```

## Copy Tool

This action uses [cosign](https://github.com/sigstore/cosign) exclusively to
copy images. This provides:

- **Signature and attestation copying**: Automatically includes all signatures
  and attestations
- **Multi-architecture support**: Copies all architectures by default
- **Modern compatibility**: Works with modern signing workflows (Sigstore,
  cosign)

## How It Works

1. Installs `cosign` in the runner environment
2. Assumes the source IAM role and retrieves ECR credentials
3. Assumes the destination IAM role and retrieves ECR credentials
4. Uses `cosign copy` to transfer the image(s) between registries, including all
   architectures, signatures, and attestations
5. For matrix mode, iterates through all images sequentially
6. Generates a promotion summary with detailed results
7. Displays the summary on the GitHub Actions summary page
8. Uploads promotion results as an artifact (both Markdown and JSON formats)

## Promotion Results

After promotion completes, the action provides:

### GitHub Actions Summary

A formatted summary appears on the job summary page showing:

- Timestamp of promotion
- List of promoted images with source and destination details
- Source and destination AWS regions
- Duration for each image
- Success/failure status

### Artifact Upload

An artifact named `promotion-results-<run-id>` is uploaded containing:

- `promotion-summary.md`: Human-readable Markdown summary
- `promotion-results.json`: Machine-readable JSON with all promotion details

Artifacts are retained for 30 days and can be downloaded for auditing or
integration with other tools.

**Example JSON structure:**

```json
{
  "promotions": [
    {
      "source_repository": "app1",
      "source_tag": "v1.0.0",
      "destination_repository": "app1",
      "destination_tag": "v1.0.0",
      "duration_seconds": "12",
      "status": "success"
    }
  ]
}
```

## Notes

- Registries can be in the same or different AWS regions
- The action uses basic authentication with ECR (username is always "AWS")
- Credentials are passed securely via environment variables
- When using the `images` input, it takes precedence over individual
  repository/tag inputs
- Promotion results are always uploaded as artifacts, even if the action fails
  (use `if: always()` in the upload step)
- The script is implemented with reusable functions for both JSON and Markdown
  output, ensuring maintainability and clarity.

## Troubleshooting

### Image Not Found

Verify the source repository name and tag are correct, and that the image exists
in the source registry.

### Multi-Arch Issues

If you're seeing issues with multi-architecture images, ensure your source
images are properly built as multi-arch manifests. Cosign will copy all
architectures by default.
