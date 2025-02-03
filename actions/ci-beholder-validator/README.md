# Schema Registry Validator Action

Easily validate your schema changes for backward compatibility using a **local
Redpanda** instance within a GitHub Actions workflow. The **Schema Registry
Validator** action ensures that you catch breaking schema changes before merging
pull requests.

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Requirements & Prerequisites](#requirements--prerequisites)
4. [Usage](#usage)
5. [Example: End-to-End Integration](#example-end-to-end-integration)
6. [Configuration](#configuration)

- [Required Inputs](#required-inputs)
- [Optional AWS Inputs](#optional-aws-inputs)

7. [Schema Configuration (`beholder.yaml`)](#schema-configuration-beholderyaml)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)

---

## Overview

When you update .proto or .avsc schema files, you risk introducing incompatible
changes that can break your applications. This action:

1. Starts a local Redpanda registry for schema validation
2. Pulls a validator image from AWS ECR (or other registries)
3. Detects changed schema files in your pull request
4. Checks schema evolution compatibility against your default branch
5. Reports any failures directly in GitHub Actions logs

6. This helps maintain stable contracts across services that rely on these
   schemas, ensuring changes remain backward-compatible.

---

## How It Works

1. **Checkout & Detect Changes**

- The action clones your repo, fetches the default branch, and detects which
  schema files changed in the pull request.

2. **Spin Up Redpanda**

- A Docker Compose file starts a local Redpanda service (with schema registry)
  inside your GitHub Actions runner.

3. **Pull Schema Validator**

- The action retrieves the schema-validator Docker image from your specified
  registry (e.g., AWS ECR).

4. **Validate “Master” (Default) Branch**

- Checks all schemas on your default branch to ensure they’re valid.

5. **Validate PR Branch (Changed Files)**

- Only the files that changed in this PR are validated. If a breaking change is
  introduced, you’ll see the failure logs in your PR’s workflow run.

6. **Report Success or Failure**

- The action logs details about which files passed or failed schema
  compatibility checks. A failing run will block merging until resolved.

---

## Requirements & Prerequisites

- **GitHub repository** with Actions enabled
- **Docker** available in the GitHub Actions runner
- A `beholder.yaml` file describing your schemas (see
  [Schema Configuration](#schema-configuration-beholderyaml))
- If you’re pulling from AWS ECR:
  - Valid AWS credentials or IAM role
  - [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
    (used within the workflow)

---

## Usage

Add this action to your workflow like in example shown below. An example repo
can be found
[here](https://github.com/smartcontractkit/schema_validator_example)

```yaml
name: schema-validator-example
on:
  push:
    branches:
      - main
      - test
  pull_request:
    paths:
      - ".github/workflows/schema_validator_example.yaml"
      - "**.proto"
      - "**.avsc"
      - "**/beholder.yaml"
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  validate-schema:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # Add this line to enable OIDC token for the job
      contents: read # This is required for actions/checkout
    steps:
      - name: Validate
        uses: smartcontractkit/.github/actions/ci-beholder-validator@{{sha-of-action}}
        with:
          role-session-name: schema-validator-example
          aws-role-arn: ${{ secrets.aws-role-arn }}
          aws-region: us-west-2
          aws-account-number: ${{ secrets.AWS_ACCOUNT_ID }}
          image-tag: "1f3c06f003948fe07df0f40287f217f9d9aa778c"
```

Note: the `{{sha-of-action}}` should be replaced with the sha of the action you
want to use.

A detailed README and the source code for the docker image can be found
[here](https://github.com/smartcontractkit/atlas/tree/master/beholder/schema_validator).

---

## Example: End-to-End Integration

Below is a **complete example** of how you might integrate this action into your
repository. It assumes:

- Your default branch is named `main`.
- You have a schema file at `schemas/pet.proto`.
- You have a `beholder.yaml` referencing `./schemas/pet.proto`.

### Step 1: Prepare `beholder.yaml`

Create a `beholder.yaml` in the root of your repo indicating where the schemas
are located in relative to the root of the repo.: Note: the schema field
**must** indicate the path to the schema file relative to the root of the repo.

```yaml
beholder:
  domain: my_app
  schemas:
    - entity: Pet
      schema: "./schemas/pet.proto"
```

### Step 2: Create .github/workflows/schema_validation.yml

```yaml
name: schema-validator-example

on:
  push:
    branches:
      - main
      - test
  pull_request:
    paths:
      - ".github/workflows/schema_validator_example.yaml"
      - "**.proto"
      - "**.avsc"
      - "**/beholder.yaml"
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  validate-schema:
    runs-on: ubuntu-latest
    permissions:
      id-token: write # Add this line to enable OIDC token for the job
      contents: read # This is required for actions/checkout
    steps:
      - name: Validate
        uses: smartcontractkit/.github/actions/ci-beholder-validator@{{sha-of-action}}
        with:
          role-session-name: schema-validator-example
          aws-role-arn: ${{ secrets.aws-role-arn }}
          aws-region: us-west-2
          aws-account-number: ${{ secrets.AWS_ACCOUNT_ID }}
          image-tag: "1f3c06f003948fe07df0f40287f217f9d9aa778c"
```

If you are creating a new Repo, you will need additional setup like setting IAM
roles and permissions. A sample PR can be found
[here](https://github.com/smartcontractkit/infra/pull/6974/files) Once the above
PR is run, you will have access to the `{{secrets.aws-role-arn}}`.
`aws-account-number` is used to fetch the image from the ECR. Hence this is same
as the aws account id of production account. The secrets can be inserted in the
repo secrets by following guide
[here](https://smartcontract-it.atlassian.net/wiki/spaces/RE/pages/906985607/GitHub+Repo+Configuration#GitHub-Secrets)

### Step 3: Open a Pull Request

When you push changes to schemas/pet.proto in a feature branch and open a PR,
GitHub Actions will automatically:

1. Spin up Redpanda for testing
2. Pull and run the schema-validator container
3. Compare changes in pet.proto to what’s in the main branch
4. Fail if there’s a backward-incompatible change
5. If validation passes, you’ll see a success status in your PR checks.

---

## Configuration

### Required Inputs

- docker-registry: Registry to pull the validator image from (currently 'aws').

### Optional AWS Inputs

If docker-registry: 'aws', you can supply:

- aws-region: AWS region hosting ECR (e.g., us-west-2).
- aws-role-arn: IAM Role ARN to assume for ECR.
- aws-role-duration-seconds: Session duration (default: 900).
- aws-account-number: AWS account ID (required if your ECR is in a non-default
  account).

---

## Schema Configuration (`beholder.yaml`)

The `beholder.yaml` file describes your schemas and their locations. Here’s an
example:

```yaml
beholder:
  domain: your_domain
  schemas:
    - entity: UserEvent
      schema: "./schemas/user_event.proto"
    - entity: OnRampEvent
      schema: "./schemas/on_ramp_event.avsc"
```

- domain: Logical namespace for your schemas, e.g., payment_service.
- schemas: List of entities, each with a friendly entity name and schema path.
- Paths such as schema: "./schemas/user_event.proto" must match your actual
  folder structure.

## Troubleshooting

1. AWS Authentication Failed
   - Check if aws-role-arn is correct.
   - Ensure the role has ECR pull permissions.
   - Verify aws-region matches your ECR location.
2. Schema Validation Failed
   - Make sure your changes are backward-compatible.
   - Verify schema file paths in beholder.yaml match the actual files.
   - Check logs for parse or registry errors.
3. Docker Issues
   - The runner must have Docker installed (e.g., ubuntu-latest includes it).
   - Check network connectivity to ECR or your registry.
   - If you see “pull access denied,” confirm you’re logged in or have correct
     permissions.
4. File Not Detected
   - Verify your PR modifies .proto, .avsc, or a path included under
     on.pull_request.paths.
   - Ensure beholder.yaml is in the correct location.

## Contributing

Contributions are welcome! Please submit PRs with improvements or bug fixes.
