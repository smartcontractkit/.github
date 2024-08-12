# Setup CRIB Environment action

> Enables PR flow for CRIB

## Description

This composite action is designed for setting up a CRIB environment. It deploys
a CRIB, configures GAP, sets up Nix, and deploys to an ephemeral environment.

## Inputs

| **Input**                    | **Description**                                                                                                                                                   | **Required** | **Default**           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------- |
| `api-gateway-host`           | API Gateway host for GAP, used to access the Kubernetes API.                                                                                                      | Yes          |                       |
| `aws-region`                 | AWS region where resources will be deployed.                                                                                                                      | Yes          |                       |
| `aws-role-arn`               | AWS Role ARN to be used for setting up GAP.                                                                                                                       | Yes          |                       |
| `devspace-ingress-cidrs`     | DevSpace ingress CIDRs to control access.                                                                                                                         | No           | `0.0.0.0/0`           |
| `devspace-profiles`          | Comma-separated list of DevSpace profiles to apply when running DevSpace commands. Example: `ci,values-dev-simulated-core-ocr1`.                                  | No           | `""`                  |
| `ecr-private-registry`       | ECR private registry account ID for Production, needed for GAP.                                                                                                   | No           | `""`                  |
| `ecr-private-registry-stage` | ECR private registry account ID for Staging.                                                                                                                      | No           | `""`                  |
| `github-token`               | The `GITHUB_TOKEN` issued for the workflow.                                                                                                                       | No           | `${{ github.token }}` |
| `image-tag`                  | Docker image tag for the product.                                                                                                                                 | No           | `latest`              |
| `ingress-base-domain`        | Base domain for DevSpace ingress.                                                                                                                                 | Yes          |                       |
| `k8s-cluster-name`           | Kubernetes cluster name.                                                                                                                                          | Yes          |                       |
| `ns-ttl`                     | Namespace TTL, which defines how long a namespace will remain alive after creation, unless crib-purge-environment is configured to purge it once the job is done. | No           | `1h`                  |
| `product`                    | The name of the product (e.g., `core`, `ccip`).                                                                                                                   | No           | `core`                |

## Outputs

| **Output**           | **Description**                                            |
| -------------------- | ---------------------------------------------------------- |
| `devspace-namespace` | Kubernetes namespace used to provision a CRIB environment. |
| **Value**            | `${{ steps.generate-ns-name.outputs.devspace-namespace }}` |
