# policy-bot-config-validator

For validating changes to `.policy.yml` files which are used by
[policy-bot](https://github.com/palantir/policy-bot/).

## Usage

### Requirements

For publicly accessible policy-bots simply pass the `policy-bot-host` input.

For secured policy-bots (internal), pass:

- `setup-gap: true`
- `main-dns-zone` - The DNS zone used for exposing services

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
        uses: actions/checkout@v4

      - name: Policy Bot Validator
        uses: smartcontractkit/.github/actions/policy-bot-config-validator@<ref>
        with:
          setup-gap: true
          main-dns-zone: ${{ secrets.MAIN_DNS_ZONE }} # required if setup-gap is "true"
          # optional inputs - showing default values
          aws-region: "us-west-2"
          policy-yml-path: ".policy.yml"
          dynamic-proxy-port: "9090"
          enable-proxy-debug: "false"
```
