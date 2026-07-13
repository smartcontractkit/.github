# verify-docker-signature

Verify a [cosign](https://github.com/sigstore/cosign) signature on a Docker
image or manifest index, retrying to absorb Sigstore/Rekor propagation lag (the
`no signatures found` false negative that can occur right after a successful
sign).

Verification is intentionally decoupled from manifest create/sign. Running it as
its own step/job lets a propagation flake be retried **without** re-running
create/sign — the sequence that previously caused index digest drift
([RANE-4683](https://smartcontract-it.atlassian.net/browse/RANE-4683)).

## Example usage

```yaml
verify-manifest-signature:
  needs: [docker-manifest]
  runs-on: ubuntu-24.04
  permissions:
    contents: read
    id-token: write # assume AWS IAM role via OIDC for registry read
  steps:
    - uses: aws-actions/configure-aws-credentials@v6
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_PUBLISH_ARN }}
        aws-region: us-east-1
    - uses: aws-actions/amazon-ecr-login@v2
      with:
        registry-type: public
        registries: ${{ secrets.AWS_ACCOUNT_ID }}
    - uses: smartcontractkit/.github/actions/verify-docker-signature@verify-docker-signature/v1
      with:
        image: ${{ needs.docker-manifest.outputs.name-with-digest }}
        identity-regexp: "^https://github.com/smartcontractkit/.*$"
        workflow-repository: ${{ github.repository }}
```

## Inputs

| Input                 | Required | Default                                       | Description                                                          |
| --------------------- | -------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `image`               | yes      |                                               | Image reference to verify, including digest (`repo@sha256:...`).     |
| `identity-regexp`     | yes      |                                               | Expected Fulcio certificate identity regexp (prefix `^`/suffix `$`). |
| `workflow-repository` | yes      |                                               | Expected GitHub workflow repository (`owner/repo`).                  |
| `oidc-issuer`         | no       | `https://token.actions.githubusercontent.com` | Expected certificate OIDC issuer.                                    |
| `max-retries`         | no       | `5`                                           | Maximum verification attempts.                                       |
| `retry-delay-seconds` | no       | `10`                                          | Delay between attempts, in seconds.                                  |
| `cosign-release`      | no       | `v2.6.1`                                      | cosign version to install.                                           |

## Notes

- The caller is responsible for registry authentication (e.g. ECR login) before
  invoking this action, since `cosign verify` reads the manifest and signature
  from the registry.
