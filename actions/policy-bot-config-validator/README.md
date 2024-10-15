# policy-bot-config-validator

For validating changes to `.policy.yml` files which are used by
[policy-bot](https://github.com/palantir/policy-bot/).

## Usage

### Requirements

For publicly accessible policy-bots simply pass the `policy-bot-host` input.

For secured policy-bots (internal), pass:

- `setup-gap: true`
- `aws-region` - the `aws-region` such as `us-east-1`
- `aws-role-arn` - the GH OIDC IAM role ARN with permission to execute the below
  API Gateway
- `api-gateway-host` - The API gateway host such as:
  `<id>.execute-api.<region>.amazonaws.com`

### Workflow (secured endpoint)

```yml
name: Validate PolicyBot Config Changes

on:
  pull_request:
    paths:
      - .policy.yml

jobs:
  policy-yml-validation:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      actions: read
      contents: read
    steps:
      - name: Checkout the repo
        uses: actions/checkout@v4.2.1

      - name: Policy Bot Validator
        uses: smartcontractkit/.github/actions/policy-bot-config-validator@<commit> # policy-bot-config-validator@x.y.z
        with:
          setup-gap: true
          aws-region: ${{ secrets.AWS_REGION }}
          aws-role-arn: ${{ secrets.AWS_OIDC_IAM_ROLE }}
          api-gateway-host: ${{ secrets.AWS_API_GW_HOST }}
          policy-yml-path: ".policy.yml" # this input defaults to ".policy.yml"
```

and optional metrics inputs:

```yml
# Optional metrics inputs
metrics-job-name: "policy-yml-validation"
gc-basic-auth: ${{ secrets.GRAFANA_INTERNAL_BASIC_AUTH }}
gc-host: ${{ secrets.GRAFANA_INTERNAL_HOST }}
gc-org-id: ${{ secrets.GRAFANA_INTERNAL_TENANT_ID }}
```
