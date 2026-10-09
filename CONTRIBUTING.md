# Contributing

This document covers setting up this repository, creating and modifying actions,
and how versioning works.

- [Setup](#setup)
  - [Dependencies](#dependencies)
  - [Post-Install](#post-install)
  - [Common Tasks](#common-tasks)
- [New Actions](#new-actions)
- [Existing Actions](#existing-actions)
- [Versioning](#versioning)

## Setup

### Dependencies <!-- omit in toc -->

- [`mise`](https://mise.jdx.dev/) - manages the `node`, `pnpm`, and `shellcheck`
  versions pinned in the repo root [`mise.toml`](mise.toml)

### Post-Install <!-- omit in toc -->

- `mise install` - will install versions as per the `mise.toml` file
- `mise run install` - install all npm dependencies (`pnpm install`) and the git
  pre-commit hook (`pnpm lefthook install`)
  - `pnpm lefthook run pre-commit` - to run the pre-commit hook manually

### Common Tasks <!-- omit in toc -->

Common operations are available as mise tasks, runnable from anywhere in the
repo:

| Task                      | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `mise run lint`           | Lint all projects                              |
| `mise run build`          | Build all projects                             |
| `mise run test`           | Test all projects                              |
| `mise run format`         | Format all files with prettier                 |
| `mise run workflows:sync` | Sync reusable workflows into .github/workflows |

These delegate to the pnpm scripts in the root `package.json`, which can also be
invoked directly (`pnpm run lint`, etc.).

## New Actions

1. Generate the Action boilerplate
   ```sh
   pnpm nx generate nx-chainlink:create-gh-action
   ```
2. Make your changes
3. Add a changeset for your new action (`pnpm changeset`)
4. Commit and open a PR

## Existing Actions

1. Modify the action as needed
2. Build the action if it is written in JS/TS
3. Add a changeset (`pnpm changeset`)
4. Commit and open a PR

## Versioning

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
