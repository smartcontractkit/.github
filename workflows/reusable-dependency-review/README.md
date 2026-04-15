# Reusable Dependency Review

This workflow analyzes dependencies introduced by pull requests to help identify
security vulnerabilities and for invalid dependency licenses.

## Usage

```yaml
jobs:
  dependency-review:
    uses: smartcontractkit/.github/.github/workflows/reusable-dependency-review.yml@<ref>
    with:
      config-preset: license-deny-vulnerability-high # Optional, default value is "license-deny-vulnerability-high"
```
