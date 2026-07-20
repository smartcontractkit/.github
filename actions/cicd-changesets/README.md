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
