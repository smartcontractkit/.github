# ci-publish-npm

This action publishes things to NPM.

## Usage

### Setup

1. Declare a publish script inside your `package.json` ([example](https://github.com/smartcontractkit/chainlink/blob/b8199c52e22c0c1a875713e0d01df21466a91567/contracts/package.json#L19-L20))
2. Ensure the `NPM_TOKEN` exists and is accessible by the calling workflow

### Running

Ensure all testing is complete, and `pnpm` is setup prior to calling this action.

#### Inputs

1. `publish-command` - The actual publish script to run, as defined in your `package.json`. The action will run `pnpm <publish command>`.
2. `package-json-directory` - The sub directory of the `package.json` if not at the root of the repository.
3. `npm-token` - The NPM access token with permissions to publish to the repository.
4. `create-github-release` - Whether to create a Github release.
5. `github-release-tag-name` - The release's tag name
6. `github-token` - The `GITHUB_TOKEN` issued for the workflow. Used when creating Github releases.
