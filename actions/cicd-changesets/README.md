# cicd-changesets

> changesets

Runs [changesets](https://github.com/changesets/changesets) versioning and
publishing (via the `signed-commits` action) on pushes to the default branch.

## Authentication

The action needs a GitHub token to check out the repo and to create/publish the
"Version Packages" release PR and tags. There are two modes:

### Default token (default)

By default the action uses the automatic `GITHUB_TOKEN` (`github-token`, which
defaults to `${{ github.token }}`). No AWS/GATI setup is required. The calling
job must grant:

```yaml
permissions:
  contents: write
  pull-requests: write
```

Note: pull requests created with `GITHUB_TOKEN` do not trigger other workflows
by default. As of
[this change](https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/),
bot-created PRs can run workflows if approved.

### GATI (optional)

To issue a token via GATI instead (e.g. to trigger downstream workflows without
approval, or to commit as an app identity), provide the AWS inputs. When
`aws-role-arn` is set, GATI is used and `github-token` is ignored. This mode
requires the calling job to grant `id-token: write` and to have the GATI IAM
role and lambda URL configured:

```yaml
permissions:
  id-token: write
  contents: read
```

```yaml
with:
  aws-region: us-west-2
  aws-role-arn: ${{ secrets.AWS_ROLE_ARN_GATI_CHANGESETS }}
  aws-lambda-url: ${{ secrets.AWS_LAMBDA_URL_GATI }}
```

## Package manager

`package-manager` selects the toolchain; defaults to `pnpm`.

### pnpm

Installs Node and pnpm, runs `pnpm install`, and defaults the changesets
commands to `pnpm run ci:changeset:{version,publish}`. The repo's `package.json`
must resolve a Node version (via `engines.node` or `node-version-file`).

### bun

```yaml
with:
  package-manager: bun
```

Installs bun (not Node/pnpm), runs `bun install --frozen-lockfile`, and defaults
the changesets commands to `bun run ci:changeset:{version,publish}`. Define
those scripts in `package.json`:

```json
{
  "scripts": {
    "ci:changeset:version": "bun run changeset version",
    "ci:changeset:publish": "bun run changeset publish"
  },
  "devDependencies": { "@changesets/cli": "~2.31.0" }
}
```

#### Bun version

Resolved in order: `bun-version` (explicit) → `bun-version-file` →
auto-detection (the default).

setup-bun reads `.tool-versions`, `.bun-version`, and `package.json` natively,
so those are forwarded to it. This action reads `mise.toml` itself (setup-bun
does not understand mise) and passes the version to setup-bun. With both inputs
empty it auto-detects: mise file first, then `.tool-versions`/`.bun-version`,
then `package.json`, then `latest`.

A repo that pins bun in `mise.toml` (as the `ts-service` blueprint does) needs
no `bun-version` input.
