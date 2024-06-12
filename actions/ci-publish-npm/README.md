# ci-publish-npm

This action optionally creates a Github release, sets up the `.npmrc` file, and
then runs a command to publish something to NPM.

## Usage

### Setup

Obtain an NPM token scoped to your npm package with the necessary permissions.

### Running

Ensure all testing is complete, and `pnpm` is setup prior to calling this
action.

#### Inputs

1. `publish-command` - The command which will be run to publish.
2. `package-json-directory` - The sub directory of the `package.json`. Supply if
   the publish command executes a script declared within the `package.json` and
   is not located at the root of the repository.
3. `npm-token` - The NPM access token with permissions to publish to the
   repository.
4. `create-github-release` - Whether to create a Github release.
5. `github-release-tag-name` - The release's tag name
6. `github-token` - The `GITHUB_TOKEN` issued for the workflow. Supply when
   creating Github releases. Requires `contents: write` permissions"
