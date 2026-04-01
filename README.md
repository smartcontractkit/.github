# .github <!-- omit in toc -->

This repository contains reusable Github Actions to be used across our extensive
network of repositories.

- [Using Actions](#using-actions)
  - [Action Versions](#action-versions)
  - [Automated Updates](#automated-updates)
- [Contributing](#contributing)
  - [Setup](#setup)
  - [New Actions](#new-actions)
  - [Existing Actions](#existing-actions)
  - [Versioning](#versioning)
- [Example Usage](#example-usage)

## Using Actions

To use the actions in this repo you should will place the action reference in
the `uses` field of a Job step
([docs](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsuses)).

```
  - uses: smartcontractkit/.github/actions/<action>@<commit> # <action>@<version>
```

### Action Versions

This is a monorepo and all actions are versioned and tagged with the format
`<action>/vX.Y.Z` or w/ mutable major version tags `<action>/vX`. To find the
available versions, and corresponding commit for an action:

- Look at the repo's tags through Github UI:
  https://github.com/smartcontractkit/.github/tags
- Query the tags through CLI (faster)
  ```sh
  git for-each-ref --format="%(objectname) %(refname:short)" refs/tags | grep "<action name>"
  ```

### Automated Updates

We recommend using the major version tags for actions stored within this
repository. This ensures that all actions are automatically updated if new minor
or patch versions are released for the major version you are pinned to.

## Contributing

### Setup

#### Dependencies <!-- omit in toc -->

- [`asdf`](https://asdf-vm.com/)
- [`pnpm`](https://pnpm.io/)
- `nodejs`

#### Post-Install <!-- omit in toc -->

- `asdf install` - will install versions as per the `.tool-versions` file
- `pnpm install` - install all npm dependencies as required
- `pnpm lefthook install` - install the git pre-commit hook for formatting
  - `pnpm lefthook run pre-commit` - to run the pre-commit hook manually

### New Actions

1. Generate the Action boilerplate
   ```sh
   pnpm nx generate nx-chainlink:create-gh-action
   ```
2. Make your changes
3. Add a changeset for your new action (`pnpm changeset`)
4. Commit and open a PR

### Existing Actions

1. Modify the action as needed
2. Build the action if it is written in JS/TS
3. Add a changeset (`pnpm changeset`)
4. Commit and open a PR

### Versioning

Actions are versioned through an automated process managed by
[`changesets`](https://github.com/changesets/changesets). The process is as
follows:

1. You merge a change with a changeset file (in the `.changeset` directory)
   1. Created through invoking `pnpm changeset`
   2. Or through [`gocs`](https://github.com/smartcontractkit/gocs)
      (`go install github.com/smartcontractkit/gocs/cmd/gocs@latest`)
2. A "Version packages" pull request will open or update
   ([ex](https://github.com/smartcontractkit/.github/pull/540)). This PR will
   "consume" the changesets present in the default branch by:
   1. Deleting the changeset files
   2. Adding the changeset content to the respective changelogs
   3. Bump the versions in the `package.json` according to the changeset
      (patch/minor/major)
3. The "Version packages" PR gets merged, and the git tags for the actions'
   versions will be created during CICD.

## Example Usage

Below are example "Golden Path" repositories that utilize these reuseable
actions.

- Go application:
  [`smartcontractkit/releng-go-app`](https://github.com/smartcontractkit/releng-go-app)
- Go library:
  [`smartcontractkit/releng-go-lib`](https://github.com/smartcontractkit/releng-go-lib)
- TypeScript application:
  [`smartcontractkit/releng-ts-app`](https://github.com/smartcontractkit/releng-ts-app)
- Solidity contracts:
  [`smartcontractkit/releng-sol-contracts`](https://github.com/smartcontractkit/releng-sol-contracts)
