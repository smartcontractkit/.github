# invoke-gati-v2

Mints a scoped GitHub installation access token from the GATI v2 token issuer,
authenticated with a GitHub OIDC token. The token is revoked automatically when
the job finishes.

Supersedes
[`invoke-gati`](https://github.com/smartcontractkit/.github/tree/main/actions/invoke-gati)
(v1), which required assuming an AWS role first. This action needs no AWS
credentials.

## Requirements

The calling job must be able to mint OIDC tokens:

```yaml
permissions:
  id-token: write
```

Without it the action fails immediately, before making any network call.

## Inputs

| Name      | Description                                                                                                                                     | Required | Defaulted                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------- |
| `profile` | The token profile to request. See [Profiles](#profiles).                                                                                        | ✅       |                               |
| `url`     | Overrides the endpoint to request the token from.                                                                                               | ❌       | ✅                            |
| `retries` | Additional attempts when the request fails with a network error, `429`, a `5xx`, or a `2xx` with an empty or non-JSON body, with exponential backoff. `4xx` fails immediately. | ❌       | ✅ - `"0"` (a single attempt) |

## Outputs

| Name           | Description                                                                      |
| -------------- | -------------------------------------------------------------------------------- |
| `access-token` | The scoped GitHub installation access token. Masked in logs, revoked on cleanup. |

## Profiles

A profile determines which repositories the returned token can reach and what it
can do there. Profiles are configured outside this repository — ask the team
that owns GATI which profiles are available to yours.

There are 4 profile types:

| Profile             | Refers to                                    |
| ------------------- | -------------------------------------------- |
| `<name>`            | A profile defined for the calling repository |
| `presets/<name>`    | A shared preset                              |
| `globals/<name>`    | A shared global                              |
| `v1/<iam-role-arn>` | The GATI v1 entry for an IAM role ARN        |

Names in the first three forms must be non-empty and must not contain `/`. A v1
role ARN is used as given, including its colons and any role path.

Malformed profiles fail the step with a message naming the rule that was
violated, before any token is requested.

## Token lifetime

The action stores the token in step state and revokes it via
[`DELETE /installation/token`](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token)
in its post step, which GitHub runs at the end of the job. Revocation cannot be
disabled. If it fails, the action emits a warning rather than failing the job —
the token expires on its own regardless, and failing a green job would not
un-issue it.

Because revocation is scoped to the job, do not pass this token to another job
via job outputs; request a new one in each job that needs it.

## Rate limit monitoring

After minting the token, the action calls
[`GET /rate_limit`](https://docs.github.com/en/rest/rate-limit/rate-limit#get-rate-limit-status-for-the-authenticated-user),
which does not count against the rate limit, and logs the remaining, used, and
reset time of every bucket. If that call fails, the action logs it and carries on.

The post step makes no extra call. It logs the `x-ratelimit-*` headers of the
revocation response instead, which cover only the bucket that response was
charged to (normally `core`).

A bucket with 10% or less of its limit remaining is logged as a warning.
Installation tokens share one budget per app installation, so the numbers include
every concurrent job that uses the same app, not only the current one.

## Example Usage

```yaml
name: example

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - name: Get a GitHub token
        id: gati
        uses: smartcontractkit/.github/actions/invoke-gati-v2@<tag>
        with:
          profile: my-profile

      - name: Use the token
        env:
          GH_TOKEN: ${{ steps.gati.outputs.access-token }}
        run: gh repo view smartcontractkit/.github
```
