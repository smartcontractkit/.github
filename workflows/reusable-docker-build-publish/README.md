# Reusable Docker Build and Publish

Reusable GitHub Actions workflow to **build** and publishes Docker images to
**AWS ECR**, producing:

- Architecture-specific images for:
  - `linux/amd64`
  - `linux/arm64` (optional)
- A **multi-arch manifest index** with optional:
  - additional alias tags (e.g., `latest`)
  - OCI annotations
  - Cosign signing (keyless via OIDC)

This workflow is designed to be called via `workflow_call` from other
repositories/workflows.

---

## What it does

1. Initializes build metadata
   - Determines date (`YYYYMMDD`), short SHA (`7 chars`), PR number (for PR
     builds), and a `build-type` derived from the triggering event.
2. Optionally configures Docker build cache behavior
   - `disable`, `enable`, or `write-on-trunk` (default).
3. Builds native per-architecture images
   - Builds one image per architecture (tag includes the arch suffix).
   - Uses an internal `build-push-docker` action.
4. Creates a multi-arch manifest index
   - Uses an internal `build-push-docker-manifest` action.
   - Adds standard OCI annotations (plus optional user annotations).
   - Optionally signs the manifest.

---

## Permissions required by the calling workflow

At minimum:

```yaml
permissions:
  contents: read # checkout
  id-token: write # OIDC to assume AWS role(s)
```

---

## Usage

### Minimal example (push to private ECR)

```yaml
jobs:
  docker-build-publish:
    permissions:
      contents: read
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-docker-build-publish.yml@<git-sha>
    with:
      aws-ecr-name: chainlink
      aws-region-ecr: us-east-1
      dockerfile: Dockerfile
      docker-build-context: .
      git-sha: ${{ github.sha }}
      github-event-name: ${{ github.event_name }}
      github-ref-name: ${{ github.ref_name }}
      github-workflow-repository: ${{ github.repository }}
      # Optional but recommended when using push events:
      github-ref-type: ${{ github.ref_type }}
    secrets:
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_ROLE_PUBLISH_ARN: ${{ secrets.AWS_ROLE_PUBLISH_ARN }}
```

### Example with tag prefix stripping, extra manifest tags, and annotations

```yaml
jobs:
  docker-build-publish:
    permissions:
      contents: read
      id-token: write
    uses: smartcontractkit/.github/.github/workflows/reusable-docker-build-publish.yml@<git-sha>
    with:
      aws-ecr-name: chainlink
      aws-region-ecr: us-east-1
      dockerfile: Dockerfile
      docker-build-context: .
      docker-image-tag-strip-prefix: v
      docker-manifest-additional-tags: |
        latest
        qa-latest
      docker-manifest-annotations: |
        org.opencontainers.image.description=node of the decentralized oracle network
        org.opencontainers.image.licenses=NOASSERTION
        org.opencontainers.image.ref.name=ubuntu
      docker-manifest-sign: "true"
      git-sha: ${{ github.sha }}
      github-event-name: ${{ github.event_name }}
      github-ref-name: ${{ github.ref_name }}
      github-ref-type: ${{ github.ref_type }}
      github-workflow-repository: ${{ github.repository }}
    secrets:
      AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
      AWS_ROLE_PUBLISH_ARN: ${{ secrets.AWS_ROLE_PUBLISH_ARN }}
```

### Build-only (no push, no manifest)

```yaml
with:
  docker-push: "false"
  # ...other required inputs...
```

> When `docker-push` is `"false"`, the `docker-manifest` job is skipped.

---

## Authentication for private GitHub dependencies during Docker builds

This workflow supports two ways to authenticate `git` operations inside Docker
builds (e.g., `go get` / `npm install` from private repos):

### Option A: Provide an override GitHub token (FPAT)

Set the secret:

- `GITHUB_TOKEN_DOCKER_BUILD_OVERRIDE`

This token will be passed to the Docker build action as the token secret.

### Option B: Use GATI (GitHub Actions Token Issuer)

If all of the following are provided:

- `secrets.AWS_ROLE_GATI_ARN`
- `secrets.AWS_LAMBDA_GATI_URL`
- (and you did **not** set `GITHUB_TOKEN_DOCKER_BUILD_OVERRIDE`)

…the workflow will fetch a token via the `setup-github-token` action and use it
for the build.

Optional helper:

- `set-git-config-gati: "true"` to configure git for GATI usage (when needed by
  your build tooling).

---

## Tagging strategy

The workflow generates a single **base tag** and then appends the architecture
suffix when building images:

- Image tags: `<baseTag>-amd64`, `<baseTag>-arm64`
- Manifest tag: `<baseTag>` (no arch suffix)

### How the base tag is chosen

If `docker-image-tag-override` is set, that value is used (no custom suffix is
applied).

Otherwise the base tag is derived from `github-event-name`:

| Build type | Trigger                    | Base tag format                                            |
| ---------- | -------------------------- | ---------------------------------------------------------- |
| `nightly`  | `schedule`                 | `nightly-YYYYMMDD{customSuffix}`                           |
| `branch`   | `push` to branch           | `<branch-lowercased-with-/-as-->-<shortsha>{customSuffix}` |
| `tag`      | `push` to tag OR `release` | `<ref_name_after_strip>{customSuffix}`                     |
| `pr`       | `pull_request`             | `pr-<number>-<shortsha>{customSuffix}`                     |
| `manual`   | `workflow_dispatch`        | `manual-<shortsha>{customSuffix}`                          |

Notes:

- Branch names are normalized to lowercase and `/` becomes `-`.
- `docker-image-tag-strip-prefix` (e.g., `v`) can strip prefixes from tag names.
- `docker-tag-custom-suffix` is appended to all generated tags **except** when
  using `docker-image-tag-override`.

### Extra manifest tags (aliases)

Use `docker-manifest-additional-tags` to add aliases like `latest` that point to
the same manifest index:

```yaml
docker-manifest-additional-tags: |
  latest
  stable
  qa-latest
```

These apply to the **manifest index**, not the per-arch images.

---

## OCI manifest annotations

If you do not provide `docker-manifest-annotations`, the workflow automatically
sets:

- `org.opencontainers.image.source` (from `github-workflow-repository`)
- `org.opencontainers.image.url` (from `github-workflow-repository`)
- `org.opencontainers.image.revision` (from `git-sha`)
- `org.opencontainers.image.version` (from the manifest tag)
- `org.opencontainers.image.title` (from `aws-ecr-name`)

Always set (cannot be overridden):

- `org.opencontainers.image.created` (UTC timestamp)

If you provide `docker-manifest-annotations`, your values are merged **after**
defaults, so they override duplicates.

---

## Docker build cache behavior

Controlled by `docker-cache-behaviour`:

- `disable`: don’t read/write cache
- `enable`: read/write cache on all events
- `write-on-trunk` (default):

  - **restore** cache always
  - **save** cache only on `push` to the repo default branch

---

## Inputs

### Required inputs

- `aws-ecr-name` — ECR repository name (no registry URL, no tag)
- `aws-region-ecr` — ECR region
- `dockerfile` — path to Dockerfile
- `docker-build-context` — build context directory
- `git-sha` — full SHA to check out and build
- `github-event-name` — triggering event name (`push`, `pull_request`, etc.)
- `github-ref-name` — short ref name (branch or tag)
- `github-workflow-repository` — repository that invoked the workflow (e.g.,
  `org/repo`)

### Common optional inputs

- `build-arm64-image` (`"true"`/`"false"`) — enable/disable arm64 build
- `docker-push` (`"true"`/`"false"`) — build only or build+push
- `docker-target` — target stage
- `docker-build-args` — build args string
- `docker-build-contexts` — additional build contexts
- `docker-pre-build-commands` — shell commands to run before build
- `docker-registry-url-override` — override ECR registry hostname (e.g., public
  ECR)
- `docker-image-tag-override` — force the base tag
- `docker-image-tag-strip-prefix` — strip prefix from tag refs (e.g., `v`)
- `docker-tag-custom-suffix` — append suffix to generated base tag (e.g.,
  `-plugins`)
- `docker-manifest-sign` (`"true"`/`"false"`) — sign manifest index
- `docker-manifest-additional-tags` — alias tags for manifest
- `docker-manifest-annotations` — extra/override annotations
- `environment` — environment name
- `timeout` — job timeout minutes (default `30`)
- `free-disk-space` (`"true"`/`"false"`) — attempt to free disk before build
- `github-runner-amd64`, `github-runner-arm64` — runner labels

---

## Secrets

### Required

- `AWS_ACCOUNT_ID` — AWS account id for ECR
- `AWS_ROLE_PUBLISH_ARN` — OIDC role ARN used to publish to ECR

### Optional (for GATI)

- `AWS_ROLE_GATI_ARN`
- `AWS_LAMBDA_GATI_URL`

### Optional (token override)

- `GITHUB_TOKEN_DOCKER_BUILD_OVERRIDE`

---

## Outputs

- `docker-image-sha-digest-amd64` — digest for amd64 image
- `docker-image-sha-digest-arm64` — digest for arm64 image (empty if disabled)
- `docker-manifest-digest` — digest of the manifest index
- `docker-manifest-name` — full manifest name
- `docker-manifest-tag` — manifest tag (base tag)

---

## Troubleshooting

### PR builds fail input validation

For `pull_request` events, `github-ref-name` **must** match:

- `<pr_number>/merge`

If you pass something else, the workflow will fail early.

### Cache mode error

`docker-cache-behaviour` must be one of:

- `disable`
- `enable`
- `write-on-trunk`

### arm64 runner availability

The default arm64 runner is `ubuntu-24.04-arm`, but some environments (notably
private/internal repos) may not have it. Override with:

```yaml
github-runner-arm64: <your-arm64-runner-label>
```

---

## Notes

- The workflow checks out the repository at `inputs.git-sha` (shallow fetch).
- Manifest creation runs only when `docker-push: "true"`.
- Tag values are validated to ensure they’re compatible with common Docker tag
  rules and `docker/metadata-action` conventions.
