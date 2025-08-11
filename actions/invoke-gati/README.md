# Invoke Github App Token Issuer

- [Invoke Github App Token Issuer](#invoke-github-app-token-issuer)
- [Usage](#usage)
  - [Standalone Usage](#standalone-usage)
- [Syncing](#syncing)

This action lets fetch a github installation access token based on your current
IAM role. Your IAM role determines the following:

- What repositories you have access to
- What permissions you have across the repositories

# Usage

This action is not intended to be used by itself. It is intended to be called
from the [`setup-github-token`](../setup-github-token/) action.

## Standalone Usage

```yml
steps:
  - name: Assume role
    uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502 # v4.0.2
    with:
      role-to-assume: ${{ secrets.role-to-assume }}
      aws-region: ${{ secrets.aws-region }}

  - name: Get github installation access token
    uses: smartcontractkit/.github/actions/invoke-gati@<ref>
    with:
      url: ${{ secrets.GATI_URL }}
```

# Syncing

The `sync.sh` script may be run manually to sync, in the case of an update.

This action used to live here:
https://github.com/smartcontractkit/chainlink-github-actions/tree/main/github-app-token-issuer.
The automated syncing mechanism was configured there, but hasn't been configured
for the `.github` repository, due to how infrequent the updates are.
