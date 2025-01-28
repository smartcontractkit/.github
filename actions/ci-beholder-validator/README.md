# Schema Registry Validator Action

A GitHub Action that validates schema compatibility against your schema registry
during pull requests. This action helps prevent breaking changes by
automatically checking schema evolution compatibility before changes are merged.

## Overview

The Schema Registry Validator action automatically:

1. Spins up a local Redpanda schema registry for testing
2. Validates your schemas against it
3. Ensures schema changes maintain backward compatibility
4. Reports validation results in your PR

## Prerequisites

- GitHub repository with Actions enabled
- Schema files (.proto, .avsc, etc.) in your repository
- A `beholder.yaml` configuration file

## Usage

Add this action to your workflow:

```yaml
name: Validate Schemas
on:
  pull_request:
    paths:
      - "**.proto"
      - "**.avsc"
      - "**/beholder.yaml"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: smartcontractkit/ci-beholder-validator@1.0.0
        with:
          docker-registry: "aws" # Required, supports 'aws'
          aws-region: "us-east-1" # Optional, for AWS ECR
          aws-role-arn: "arn:aws:iam::123456789:role/schema-validator" # Optional
```

A detailed README and the source code for the docker image can be found
[here](https://github.com/smartcontractkit/atlas/tree/master/beholder/schema_validator).

## Configuration

### Required Inputs

- `docker-registry`: Registry to pull the validator image from (currently
  supports 'aws')

### Optional AWS Inputs

When using AWS ECR (`docker-registry: 'aws'`):

- `aws-region`: AWS region for ECR
- `aws-role-arn`: IAM role ARN for ECR access
- `aws-role-duration-seconds`: Session duration (default: 900)
- `aws-account-number`: AWS account number

### Repository Configuration

Create a `beholder.yaml` file in your repository:

```yaml
beholder:
  domain: your_domain
  schemas:
    - entity: UserEvent
      schema: "./schemas/user_event.proto"
    - entity: OnRampEvent
      schema: "./schemas/on_ramp_event.avsc"
```

## How It Works

When a PR is created or updated, the action:

1. Checks out your repository
2. Detects changed schema files
3. Starts a local Redpanda instance for testing
4. Pulls the validator image from your registry
5. Validates schemas in both master and PR branches
6. Reports results in the github actions log

## Troubleshooting

Common issues and solutions:

**AWS Authentication Failed**

- Verify AWS role ARN is correct
- Ensure role has proper ECR permissions
- Check AWS region configuration

**Schema Validation Failed**

- Review schema changes for compatibility issues
- Verify schema files exist in specified paths
- Check beholder.yaml configuration

**Docker Issues**

- Ensure Docker is running in your workflow
- Verify registry credentials and permissions
- Check network connectivity to registry

## Contributing

Contributions are welcome! Please submit PRs with improvements or bug fixes.
