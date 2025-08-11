# Changesets Release with Signed Commits

This action for [Changesets](https://github.com/atlassian/changesets) creates a
pull request with all of the package versions updated and changelogs updated and
when there are new changesets on
[your configured `baseBranch`](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#basebranch-git-branch-name),
the PR will be updated. When you're ready, you can merge the pull request and
you can either publish the packages to npm manually or setup the action to do it
for you.

Note: this action was forked from
[changesets/action](https://github.com/changesets/action/) but was modified to
include commit signing and to support the `rootVersionPackagePath` input.

## Usage

### Inputs

- `publish` - The command to use to build and publish packages
- `version` - The command to update version, edit CHANGELOG, read and delete
  changesets. Default to `changeset version` if not provided
- `commit` - The commit message to use. Default to `Version Packages`
- `title` - The pull request title. Default to `Version Packages`
- `setupGitUser` - Sets up the git user for commits as `"github-actions[bot]"`.
  Defaults to `true`
- `createGithubReleases` - A boolean value to indicate whether to create Github
  releases after `publish` or not. Default to `true`
- `cwd` - Changes node's `process.cwd()` if the project is not located on the
  root. Default to `process.cwd()`
- `tagSeparator` - The tag separator to use. Defaults to `@`. For example git
  tags will be formatted like `<pkg>@<version>`.
- `createMajorVersionTags` - Create mutable major version tags alongside the
  specific versions. For example will maintain the `<pkg>@v1` tag for subsequent
  updates to a package.
- `rootVersionPackagePath` - Optional path to a root package that should use
  simplified `v<version>` tags instead of `<pkg><separator><version>` format.
  The package must have `chainlink.changesets.rootVersion: true` in its
  package.json. When specified, major version tags are not created for the root
  package. This allows monorepos to designate one primary package to use
  simplified versioning while other packages continue using namespaced tags.

### Outputs

- `published` - A boolean value to indicate whether a publishing is happened or
  not
- `publishedPackages` - A JSON array to present the published packages. The
  format is
  `[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]`
- `hasChangesets` - A boolean about whether there were changesets. Useful if you
  want to create your own publishing functionality.
- `pullRequestNumber` - The pull request number that was created or updated

### Example workflow:

#### Without Publishing

Create a file at `.github/workflows/release.yml` with the following content.

```yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: smartcontractkit/.github/actions/setup-nodejs@main
        with:
          pnpm-version: "^10.0.0"
          node-version-file: .tool-versions
          run-install: true
          use-cache: true

      - name: Create Release Pull Request
        uses: smartcontractkit/.github/actions/signed-commits@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### With Publishing

Before you can setup this action with publishing, you'll need to have an
[npm token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens)
that can publish the packages in the repo you're setting up the action for and
doesn't have 2FA on publish enabled
([2FA on auth can be enabled](https://docs.npmjs.com/about-two-factor-authentication)).
You'll also need to
[add it as a secret on your GitHub repo](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables)
with the name `NPM_TOKEN`. Once you've done that, you can create a file at
`.github/workflows/release.yml` with the following content.

```yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: smartcontractkit/.github/actions/setup-nodejs@<tag>
        with:
          pnpm-version: "^10.0.0"
          node-version-file: .tool-versions
          run-install: true
          use-cache: true

      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: smartcontractkit/.github/actions/signed-commits@main
        with:
          # This expects you to have a script called release which does a build for your packages and calls changeset publish
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

By default the GitHub Action creates a `.npmrc` file with the following content:

```
//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}
```

However, if a `.npmrc` file is found, the GitHub Action does not recreate the
file. This is useful if you need to configure the `.npmrc` file on your own. For
example, you can add a step before running the Changesets GitHub Action:

```yml
- name: Creating .npmrc
  run: |
    cat << EOF > "$HOME/.npmrc"
      //registry.npmjs.org/:_authToken=$NPM_TOKEN
    EOF
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### Custom Publishing

If you want to hook into when publishing should occur but have your own
publishing functionality you can utilize the `hasChangesets` output.

Note that you might need to account for things already being published in your
script because a commit without any new changesets can always land on your base
branch after a successful publish. In such a case you need to figure out on your
own how to skip over the actual publishing logic or handle errors gracefully as
most package registries won't allow you to publish over already published
version.

```yml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: smartcontractkit/.github/actions/setup-nodejs@<tag>
        with:
          pnpm-version: "^10.0.0"
          node-version-file: .tool-versions
          run-install: true
          use-cache: true

      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: smartcontractkit/.github/actions/signed-commits@<tag>
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Publish
        if: steps.changesets.outputs.hasChangesets == 'false'
        # You can do something when a publish should happen.
        run: pnpm publish
```

#### With version script

If you need to add additional logic to the version command, you can do so by
using a version script.

If the version script is present, this action will run that script instead of
`changeset version`, so please make sure that your script calls
`changeset version` at some point. All the changes made by the script will be
included in the PR.

```yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: smartcontractkit/.github/actions/setup-nodejs@main
        with:
          pnpm-version: "^10.0.0"
          node-version-file: .tool-versions
          run-install: true
          use-cache: true

      - name: Create Release Pull Request
        uses: smartcontractkit/.github/actions/signed-commits@main
        with:
          # this expects you to have a npm script called version that runs some logic and then calls `changeset version`.
          version: pnpm version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### With Root Package Support

For repositories that want to use simplified `v<version>` tags for a root
package instead of the standard `<pkg><separator><version>` format, you can
configure a root package. This is useful for monorepos where you want to
designate one primary package to use simplified versioning while other packages
continue using the standard namespaced format.

##### Root Package Configuration

To enable root package support, you must add the
`chainlink.changesets.rootVersion` flag to your package's `package.json`. This
flag serves as both a safety mechanism and an explicit opt-in to the simplified
versioning behavior.

**Why is this flag required?**

- **Safety**: Prevents accidental misconfiguration that could affect your
  versioning strategy
- **Explicit intent**: Makes it clear which package should use simplified tags
- **Validation**: The action validates this flag exists before applying root
  package behavior

Configure your root package's `package.json`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "chainlink": {
    "changesets": {
      "rootVersion": true
    }
  }
}
```

**Important Notes:**

- The `chainlink.changesets.rootVersion: true` flag is **required** for root
  package functionality
- If you specify `rootVersionPackagePath` but the package doesn't have this
  flag, the action will fail with a clear error message
- This configuration should only be added to the package you want to use
  simplified versioning
- Other packages in your monorepo should **not** have this flag

Then use the action with the `rootVersionPackagePath` input:

```yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repo
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: smartcontractkit/.github/actions/setup-nodejs@main
        with:
          pnpm-version: "^10.0.0"
          node-version-file: .tool-versions
          run-install: true
          use-cache: true

      - name: Create Release Pull Request or Publish to npm
        id: changesets
        uses: smartcontractkit/.github/actions/signed-commits@main
        with:
          rootVersionPackagePath: ./package.json
          # ... other inputs as needed ...
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

With this configuration:

- Tags for the root package will be created as `v1.0.0`, `v1.1.0`, etc.
- Other packages will still use the standard format like `package-name@1.0.0` or
  `package-name/v1.0.0`
- Major version mutable git tags like `v1` are not created for root packages
- GitHub releases will use the simplified tag format for the root package

**Important Note:** Root package support is designed for monorepos that want to
designate one primary package to use simplified `v<version>` tags while other
packages continue using the standard `<package-name><separator><version>`
format. This allows you to have a "main" package with clean version tags (like
`v1.0.0`) alongside other packages that use namespaced tags (like
`package-name@1.0.0`). For more information about changesets in different
repository structures, see the
[changesets documentation](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).

### Testing

- You can run unit tests with `pnpm nx run signed-commits:test`

#### Manual E2E Testing

_Note:_ This will modify the repo, only use this on test repos or personal
forks.

You can run the action locally by doing the following:

```
DEBUG=true INPUT_SETUPGITUSER=false INPUT_CWD="<path to local repo>" GITHUB_TOKEN=(gh auth token) INPUT_PRDRAFT=true GITHUB_REPOSITORY="<repo with changesets>" GITHUB_REF="refs/heads/main" GITHUB_SHA="<head SHA>" node actions/signed-commits/dist/index.js
```

### Notes on Tagging

`changesets` by default creates annotated git tags for versioning. However,
these tags are not signed.

So this action also rewrites the annotated tags into lightweight tags, which
point directly at a commit. Lightweight tags do not need to be signed because
they include no metadata. They are considered 'verified' by Github if the commit
in which they reference is signed/verified.

As of March 24, 2025 there is no way to create signed annotated tags using
Github's REST or GQL API.

All other methods are insecure or are debatably too much work for little return.
The general idea is to create a service account within the Github org, and
generate a signing key for it.

1. Inject key as a GHA secret, and sign annotated tags (insecure as it exposes
   signing key to runner).
2. Create a lambda service that can create signed annotated tags on request (a
   lot of work).
   - Secure because the signing key could be within AWK KMS, and the lambda
     function would be the only thing with access.
