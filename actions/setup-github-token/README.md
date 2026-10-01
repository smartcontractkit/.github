# setup-github-token action

Gets a GitHub installation access token from GATI, and optionally configures git
to authenticate with it.

Requires `id-token: write` on the calling job — v1 uses it to assume the AWS
role, v2 to authenticate to GATI directly.

## Which flow runs

- **v1** ([`invoke-gati`](../invoke-gati/)) assumes `aws-role-arn`, then calls
  the lambda at `aws-lambda-url`.
- **v2** ([`invoke-gati-v2`](../invoke-gati-v2/)) requests a `profile` over
  GitHub OIDC, with no AWS credentials.

Passing `profile` selects v2. Otherwise a staged rollout decides: the repository
name is hashed into a bucket of 0–99, and uses v2 when that bucket is below the
rollout percentage. Since the bucket never changes, a repository moves to v2
once and stays there. The percentage and the two pin lists that override it are
the `ROLLOUT_PERCENTAGE`, `FORCE_V2_REPOSITORIES`, and `FORCE_V1_REPOSITORIES`
env values on the `Resolve GATI version` step in [`action.yml`](./action.yml);
changing them needs a release. `gati-version` overrides all of the above.

## Migrated v1 roles

GATI v1 role configuration was carried into v2 automatically, keyed by the
role's IAM ARN and addressable as the profile `v1/<iam-role-arn>`. So v2 needs
no new configuration to take over from v1: given no `profile`, it derives one
from the `aws-role-arn` the caller already passes and returns a token with the
same permissions v1 would have. A caller only needs a real `profile` to get
scopes its v1 role does not already have.

## Inputs

Either `profile` or the v1 inputs must be provided.

| Name             | Description                                               | Defaulted      |
| ---------------- | --------------------------------------------------------- | -------------- |
| `set-git-config` | Configure git to use the token for `https://github.com/`. | ✅ - `"false"` |
| `gati-version`   | Force `v1` or `v2`, bypassing the rollout.                |                |

### v2

| Name      | Description                                    |
| --------- | ---------------------------------------------- |
| `profile` | Token profile to request. Selects v2 when set. |

### v1

Also read by v2 to derive a profile, see
[Migrated v1 roles](#migrated-v1-roles). Ignored when `profile` is set.

| Name                        | Description                                     | Defaulted                        |
| --------------------------- | ----------------------------------------------- | -------------------------------- |
| `aws-role-arn`              | ARN of the role that can get a token from GATI. |                                  |
| `aws-lambda-url`            | URL of the GATI lambda function.                |                                  |
| `aws-region`                | AWS region.                                     |                                  |
| `aws-role-duration-seconds` | Duration of the assumed role, in seconds.       | ✅ - `"900"`                     |
| `role-session-name`         | Session name, truncated to 64 characters.       | ✅ - run id, run number, and job |

## Outputs

| Name           | Description                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `access-token` | The token. A v2 token is revoked when its job ends, so request one per job rather than passing it between jobs. |
| `gati-version` | The GATI version that issued the token, `v1` or `v2`.                                                           |

## Example

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Setup GitHub token
        id: setup-github-token
        uses: smartcontractkit/.github/actions/setup-github-token@setup-github-token/v1
        with:
          aws-role-arn: ${{ secrets.AWS_OIDC_IAM_ROLE_ARN_GATI }}
          aws-lambda-url: ${{ secrets.AWS_LAMBDA_URL_GATI }}
          aws-region: us-west-2

      - name: Use the token
        env:
          GH_TOKEN: ${{ steps.setup-github-token.outputs.access-token }}
        run: gh repo view smartcontractkit/.github
```
