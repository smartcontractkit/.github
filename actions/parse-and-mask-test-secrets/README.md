# parse-and-mask-test-secrets

> Parse and mask test secrets from a base64-encoded file and set them as
> environment variables

Example:

```yaml
- name: Parse and Mask Test Secrets
  id: parsed-aws-test-secrets
  uses: smartcontractkit/.github/actions/parse-and-mask-test-secrets@v0.0.1
  with:
    encoded_test_secrets: ${{ steps.aws-test-secrets.outputs.secret_value }}

# Re-use parsed secrets as env variables
- name: Validate if public registry used
  id: is-image-in-public-registry
  shell: bash
  run: |
    if [[ "$E2E_TEST_CHAINLINK_IMAGE" =~ ^public\.ecr ]]; then
      echo "Using public registry for Chainlink image (no image built)."
      echo "is-image-in-public-registry=true" >> "$GITHUB_OUTPUT"
    else
      echo "Using private registry for Chainlink image."
      echo "is-image-in-public-registry=false" >> "$GITHUB_OUTPUT"
    fi
```
