# Setup Nix S3 Cache

`setup-nix-cache` configures your Nix env with the specified caches. Support
access to the internal S3 Nix cache in read-only mode and read/write mode.

## Configuration

## Inputs

| Name                    | Description                                                                                        | Required | Default     |
| ----------------------- | -------------------------------------------------------------------------------------------------- | -------- | ----------- |
| `cache-url`             | Custom Nix cache URL, for example, `'s3://<bucket-name>'` for an S3-backed cache.                  | Yes      | N/A         |
| `cache-pubkeys`         | Comma-separated list of custom Nix cache public keys.                                              | Yes      | N/A         |
| `cache-mode`            | Specify either `'read'` for read-only access or `'push'` for uploading build results to the cache. | Yes      | `read`      |
| `aws-region`            | AWS region for the S3 bucket (only applicable if `enable-aws` is true).                            | No       | `us-west-1` |
| `role-to-assume`        | AWS role to assume for cache access (optional).                                                    | No       | `""`        |
| `role-duration-seconds` | Duration in seconds for assuming the role (default: 1 hour).                                       | No       | `3600`      |
| `private-signing-key`   | Private key for signing nix artifacts to push.                                                     | No       | `3600`      |

## Usage

### Basic Example (Read-only Mode)

```yaml
name: Setup Nix Cache Example

on:
  push:
    branches:
      - main

jobs:
  setup-nix-cache:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install Nix
        uses: smartcontractkit/.github/actions/setup-nix@7a7de5813c702b2e9d042903a1e9cffd2c0b40c5

      - name: Setup Nix S3 cache
        uses: smartcontractkit/.github/actions/setup-nix-cache@7a7de5813c702b2e9d042903a1e9cffd2c0b40c5
        with:
          cache-url: "s3://bucket-name"
          cache-pubkeys: ${{ secrets.***REMOVED*** }}
          cache-mode: "read"
          aws-region: "us-west-1"
          role-to-assume: "arn role"
          role-duration-seconds: 3600
```

## Write Mode (Uploads Built Artifacts to the Cache)

```yaml
name: Setup Nix Cache and Upload Example with All Parameters

on:
  push:
    branches:
      - main

jobs:
  setup-nix-cache:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install Nix
        uses: smartcontractkit/.github/actions/setup-nix@7a7de5813c702b2e9d042903a1e9cffd2c0b40c5

      - name: Setup Nix S3 cache
        uses: smartcontractkit/.github/actions/setup-nix-cache@7a7de5813c702b2e9d042903a1e9cffd2c0b40c5
        with:
          cache-url: "s3://bucket-name"
          cache-pubkeys: ${{ secrets.***REMOVED*** }}
          cache-mode: "read"
          aws-region: "us-west-1"
          role-to-assume: "arn for role"
          role-duration-seconds: 3600
          private-signing-key: ${{ secrets.SOME_NIX_PRIVATE_KEY_FOR_SIGNING }}
```
