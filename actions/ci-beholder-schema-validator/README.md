# Schema Evolution Validator

A GitHub Action tool that validates schema evolution by checking compatibility with your schema registry when pull requests are created. The tool helps prevent breaking changes in your schemas by automatically validating them against the existing versions.

## Overview

When you create a pull request containing schema changes, this tool automatically:
1. Reads schema definitions from your `beholder.yaml` configuration
2. Makes compatibility checks against your schema registry
3. Reports any compatibility issues in the GitHub Actions log

This ensures that schema changes are caught early in the development cycle, before they can impact production services.

## Getting Started

### Prerequisites

- A schema registry service with a compatibility check endpoint
- GitHub repository with Actions enabled
- Go 1.21 or later
- Appropriate permissions to configure GitHub Secrets

### Configuration

Create a `beholder.yaml` file in your repository with your schema definitions:

```yaml
beholder:
  domain: your_domain
  schemas:
    - entity: OnRampSend
      schema: "./schemas/on_ramp_send.proto"
    - entity: OffRampSend
      schema: "./schemas/off_ramp_send.avsc"
```

Note: Schema paths should be relative to the `beholder.yaml` location.

### A sample setup without using actions folder

1. Create `.github/workflows/schema-check.yml`:

```yaml
name: Schema Compatibility Check

on:
  pull_request:
    paths:
      - '**.proto'
      - '**.avsc'
      - '**/beholder.yaml'

jobs:
  check-schemas:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Process PR branch schemas
        env:
          SCHEMA_REGISTRY_URL: ${{ secrets.SCHEMA_REGISTRY_URL }}
        run: go run cmd/schema-processor/main.go --phase pr
```

2. Add your schema registry URL as a repository secret:
    - Go to Repository Settings → Secrets and Variables → Actions
    - Add new secret: `SCHEMA_REGISTRY_URL`

### Project Structure

```
your-repo/
├── .github/
│   └── workflows/
│       └── schema-check.yml
├── cmd/
│   └── schema-processor/
│       └── main.go
├── beholder.yaml
└── schemas/
    ├── on_ramp_send.proto
    └── off_ramp_send.avsc
```

## How It Works

The tool integrates with GitHub Actions and runs automatically when:
- A pull request is created or updated
- Changes are made to schema files (.proto or .avsc)
- Changes are made to beholder.yaml

For each schema in your configuration, the tool:
1. Reads the schema file content
2. Makes a compatibility check request to your schema registry
3. Reports the result in the GitHub Actions log

### Error Handling

The tool handles several scenarios gracefully:
- **Missing Configuration**: Clear error if beholder.yaml is not found
- **Schema Registry Issues**: Detailed connection error reporting
- **Invalid Schemas**: Specific compatibility error messages
- **Configuration Errors**: Environment variable and config validation

## Development

To work on the tool locally:
1. Setup a schema registry using docker compose. Easiest way can be found [here](https://github.com/smartcontractkit/atlas/blob/master/docker-compose.redpanda.yml)
2. Run the tool with the following command for all schemas after checking out master
```bash
# Set your schema registry URL
export SCHEMA_REGISTRY_URL="your-schema-registry-url"

# Run the tool
go run cmd/schema-processor/main.go --phase master
```
3. Now make changes to the schema and then run the tool again with the following command
```bash
# Run the tool
go run cmd/schema-processor/main.go --phase pr
```

## Troubleshooting

Common issues and solutions:

**Schema Registry Connection Failed**
- Verify SCHEMA_REGISTRY_URL secret is set correctly
- Ensure schema registry is accessible from GitHub Actions

**Schema Not Found**
- Check schema paths in beholder.yaml
- Verify schema files exist in specified locations

**Configuration Not Found**
- Ensure beholder.yaml exists
- Check file location and permissions
