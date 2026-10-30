# setup-github-token action

Gets a GitHub installation access token from GATI, and optionally configures git
to authenticate with it.

Requires `id-token: write` on the calling job — v2 uses it to authenticate to
GATI directly, and the legacy v1 flow to assume the AWS role.

> [!WARNING]
>
> GATI v1 is deprecated and will be removed. If you set `gati-version: v1`, or
> use a version of this action older than `1.5.0`, upgrade to the latest version
> and drop `gati-version`. Keep passing `aws-role-arn` and v2 will issue the
> same token v1 did, see [Migrated v1 roles](#migrated-v1-roles).

## Which flow runs

By default, [`invoke-gati-v2`](../invoke-gati-v2/) requests a `profile` over
GitHub OIDC, with no AWS credentials.

Setting `gati-version: v1` forces the legacy [`invoke-gati`](../invoke-gati/)
flow instead, which assumes `aws-role-arn`, then calls the lambda at
`aws-lambda-url`. Both of those inputs are required in that case, and `profile`
must not be set.

## Migrated v1 roles

GATI v1 role configuration was carried into v2 automatically, keyed by the
role's IAM ARN and addressable as the profile `v1/<iam-role-arn>`. So v2 needs
no new configuration to take over from v1: given no `profile`, it derives one
from the `aws-role-arn` the caller already passes and returns a token with the
same permissions v1 would have. A caller only needs a real `profile` to get
scopes its v1 role does not already have.

## Inputs

Either `profile` or `aws-role-arn` must be provided.

| Name             | Description                                               | Defaulted      |
| ---------------- | --------------------------------------------------------- | -------------- |
| `set-git-config` | Configure git to use the token for `https://github.com/`. | ✅ - `"false"` |
| `gati-version`   | Set to `v1` to force the legacy GATI v1 flow.             | ✅ - `"v2"`    |

### v2

| Name      | Description               |
| --------- | ------------------------- |
| `profile` | Token profile to request. |

### v1

Only `aws-role-arn` is read by v2, to derive a profile, see
[Migrated v1 roles](#migrated-v1-roles). The rest are only used when
`gati-version` is `v1`. Ignored when `profile` is set.

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

      - name: Use the token
        env:
          GH_TOKEN: ${{ steps.setup-github-token.outputs.access-token }}
        run: gh repo view smartcontractkit/.github
```
