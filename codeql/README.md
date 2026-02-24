# CodeQL

Custom CodeQL model packs.

## Development

1. Install codeql CLI
   (https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/scan-from-the-command-line/setting-up-the-codeql-cli)

```sh
# https://formulae.brew.sh/cask/codeql
brew install --cask codeql
```

### Setup

`codeql pack init`

- https://docs.github.com/en/code-security/tutorials/customize-code-scanning/creating-and-working-with-codeql-packs

## Publishing

1. `cd` into the directory containing the `qlpack.yml` file.
2. If needed, bump the version in the `qlpack.yml`
   1. Check versions already published at
      https://github.com/orgs/smartcontractkit/packages
3. `gh auth token | codeql pack publish --github-auth-stdin`

## Using

### CodeQL Default

As far as I can tell, there is no way to configure specific repos to use
_separately_ published CodeQL model packs.

You can use model packs declared explicitly in your repository though. If you
wish to do this, follow
[these instructions](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/manage-your-configuration/editing-your-configuration-of-default-setup#extending-codeql-coverage-with-codeql-model-packs-in-default-setup).

#### At the org-level

At the org-level, you can configure all default CodeQL setups to include
specific model packs. See
[these docs](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/manage-your-configuration/editing-your-configuration-of-default-setup#extending-coverage-for-all-repositories-in-an-organization).

### CodeQL Advanced

CodeQL Advanced requires passing in a config or a pack explicitly.

For example:

`.github/codeql/codeql-actions.yml`

```yml
packs:
  - smartcontractkit/actions-all-extension@^<version>

queries:
  - uses: security-extended
```
