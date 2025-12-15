# ci-publish-npm

This action optionally creates a Github release, sets up the `.npmrc` file, and
then runs a command to publish something to NPM.

## NOTE: `v1` of this action is only compatible with certain versions of `nodejs`

`v1` of this action leverages `npm`
[trusted publishing](https://docs.npmjs.com/trusted-publishers), and therefore
requires an `npm` version of `>=11.5.1`. This version of `npm` requires is not
compatible with all versions of `nodejs`.

For example, when trying to run this action with a lesser version of `nodejs`
you will see something like:

```
npm ERR! code EBADENGINE
npm ERR! engine Unsupported engine
npm ERR! engine Not compatible with your version of node/npm: npm@11.6.2
npm ERR! notsup Not compatible with your version of node/npm: npm@11.6.2
npm ERR! notsup Required: {"node":"^20.17.0 || >=22.9.0"}
npm ERR! notsup Actual:   {"npm":"10.5.2","node":"v20.13.1"}
```

## Usage

### Setup

Ensure all testing is complete, and `pnpm` is setup prior to calling this
action.

### Running

```
...
      - name: Publish to NPM
        uses: smartcontractkit/.github/actions/ci-publish-npm@ci-publish-npm/v1
        with:
          create-github-release: false
          publish-command: "pnpm custom-publish-command"
          package-json-directory: "path/to/package"
```

#### Inputs

1. `publish-command` - The command which will be run to publish.
2. `package-json-directory` - The sub directory of the `package.json`. Supply if
   the publish command executes a script declared within the `package.json` and
   is not located at the root of the repository.
3. `create-github-release` - Whether to create a Github release.
4. `github-release-tag-name` - The release's tag name
5. `github-token` - The `GITHUB_TOKEN` issued for the workflow. Supply when
   creating Github releases. Requires `contents: write` permissions"
