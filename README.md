# .github <!-- omit in toc -->

This repository contains reusable Github Actions to be used across our extensive
network of repositories.

- [Using Actions](#using-actions)
  - [Action Versions](#action-versions)
  - [Automated Updates](#automated-updates)
- [Contributing](#contributing)
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up this repository, create
and modify actions, and how versioning works.

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
