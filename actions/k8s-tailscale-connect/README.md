# Connect to Kubernetes via Tailscale Action

This composite GitHub action connects to a Kubernetes cluster through Tailscale
network. It handles Tailscale authentication, AWS credential configuration via
OIDC, and sets up kubeconfig to use the Tailscale endpoint.

## Features

- 🔐 Secure Tailscale authentication using OAuth
- ☁️ AWS credential configuration using OIDC
- 🎯 Automatic kubeconfig setup for Tailscale endpoint
- 🔒 Proper secret masking for security
- 📝 Debug logging for troubleshooting

## Usage

```yaml
- name: Connect to Kubernetes via Tailscale
  uses: ./.github/actions/k8s-tailscale-connect
  with:
    tailscale-oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    tailscale-oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
    tailscale-tags: "tag:crib-sdk-gha"
    aws-oidc-role: ${{ secrets.AWS_OIDC_EKS_DEVENV_INTEGRATION_ROLE }}
    aws-region: ${{ secrets.AWS_EKS_STAGE_REGION }}
    eks-cluster-name: ${{ secrets.AWS_EKS_STAGE_CLUSTER_NAME }}
    tailscale-endpoint: ${{ secrets.AWS_EKS_STAGE_TAILNET_ENDPOINT }}
```

## Inputs

| Input                       | Description                                                   | Required | Example                                                 |
| --------------------------- | ------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| `tailscale-oauth-client-id` | Tailscale OAuth client ID for authentication                  | ✅       | `tskey-client-...`                                      |
| `tailscale-oauth-secret`    | Tailscale OAuth secret for authentication                     | ✅       | `tskey-...`                                             |
| `tailscale-tags`            | Tailscale tags to apply to the connection                     | ✅       | `tag:crib-sdk-gha`                                      |
| `aws-oidc-role`             | AWS IAM role ARN to assume using OIDC                         | ✅       | `arn:aws:iam::123456789012:role/GitHubActions-EKS-Role` |
| `aws-region`                | AWS region where the EKS cluster is located                   | ✅       | `us-west-2`                                             |
| `eks-cluster-name`          | Name of the EKS cluster to connect to                         | ✅       | `my-eks-cluster`                                        |
| `tailscale-endpoint`        | Tailscale endpoint URL for the EKS cluster (without https://) | ✅       | `eks-cluster.tail12345.ts.net`                          |

## Prerequisites

### GitHub Repository Settings

Your repository must be configured with the following secrets:

- `TS_OAUTH_CLIENT_ID` - Tailscale OAuth client ID
- `TS_OAUTH_SECRET` - Tailscale OAuth secret
- `AWS_OIDC_EKS_DEVENV_INTEGRATION_ROLE` - AWS IAM role ARN for OIDC
- `AWS_EKS_STAGE_REGION` - AWS region for your EKS cluster
- `AWS_EKS_STAGE_CLUSTER_NAME` - EKS cluster name
- `AWS_EKS_STAGE_TAILNET_ENDPOINT` - Tailscale endpoint for the EKS cluster

### Required Permissions

Your workflow must include these permissions:

```yaml
permissions:
  id-token: write # Required for OIDC authentication
  contents: read # Required for checkout action
```

### AWS IAM Role Setup

The AWS IAM role specified in `aws-oidc-role` must:

1. Trust the GitHub OIDC provider
2. Have permissions to:
   - `eks:DescribeCluster`
   - `eks:ListClusters`
   - Access to the specific EKS cluster

### Tailscale Setup

1. Create a Tailscale OAuth client with appropriate permissions
2. Ensure the GitHub Action runner can access your EKS cluster through Tailscale
3. Set up the appropriate Tailscale tags for access control

## What This Action Does

1. **Tailscale Connection**: Establishes a secure connection to your Tailscale
   network
2. **AWS Authentication**: Assumes an AWS role using OpenID Connect (OIDC)
3. **Kubeconfig Setup**:
   - Downloads the EKS cluster configuration
   - Modifies the server endpoint to use the Tailscale endpoint
   - Removes public certificate authority data (not needed for Tailscale
     endpoint)

## Security Considerations

- All sensitive values are properly masked in logs
- Uses pinned action versions for security
- Follows principle of least privilege for AWS permissions
- Tailscale tags provide additional access control

## Troubleshooting

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in
your repository settings.

Common issues:

- **Tailscale connection fails**: Check OAuth credentials and network access
- **AWS role assumption fails**: Verify OIDC configuration and role permissions
- **kubectl commands fail**: Ensure Tailscale endpoint is accessible and correct

## Example

See the example workflow in `.github/workflows/example-k8s-list-namespaces.yml`
for a complete usage example.
