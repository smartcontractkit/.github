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

`package-manager` selects the toolchain, and defaults to `pnpm`.

### pnpm (default)

Node and pnpm are installed, `pnpm install` runs, and the changesets commands
default to `pnpm run ci:changeset:{version,publish}`. The repo needs a
`package.json` whose `engines.node` (or whatever `node-version-file` points at)
resolves a Node version.

### bun

```yaml
with:
  package-manager: bun
  bun-version: "1.3.14"
```

Node and pnpm are not installed at all. bun is set up instead,
`bun install --frozen-lockfile` runs, and the changesets commands default to
`bun run ci:changeset:{version,publish}`. Point those scripts at the changesets
CLI in the repo's `package.json`:

```json
{
  "scripts": {
    "ci:changeset:version": "bun run changeset version",
    "ci:changeset:publish": "bun run changeset publish"
  },
  "devDependencies": { "@changesets/cli": "~2.31.0" }
}
```

Two things make this work without a Node toolchain step. `@changesets/cli` is a
Node CLI, but the runner already provides Node, and bun installs a normal
`node_modules` tree, so the `signed-commits` action resolves
`@changesets/cli/bin.js` the same way it does under pnpm. And `bun.lock` records
the root package's name and dependencies but not its own version, so a
`changeset version` bump does not invalidate the lockfile and
`--frozen-lockfile` keeps holding across releases.
