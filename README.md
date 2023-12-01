# .github

This repository contains reusable Github Actions to be used across our extensive
network of repositories.

## Table of contents

- [Actions updates](#actions-updates)
  - [Action package updates within .github monorepo](#action-package-updates-within-github-monorepo)
  - [Action package updates within application repos](#action-package-updates-within-application-repos)
- [Example usage](#example-usage)
  - [Golden path example repositories](#golden-path-example-repositories)
- [Development](#development)
  - [Creating a new action](#creating-a-new-action)

## Actions updates

### Action package updates within .github monorepo

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant R as RenovateBot
    participant MonoRepo as Monorepo
    participant CS as Changeset
    participant RP as Release Plan

    Dev->>MonoRepo: 1a: Modify package
    R->>MonoRepo: 1b: Create PR for dependency updates
    MonoRepo->>Dev: 2. Notify about PR
    Dev->>MonoRepo: 3. Review & merge PR
    Dev->>CS: 4. Add/Modify Changeset file based on changes
    MonoRepo->>CS: 5. Identify impacted packages
    CS->>RP: 6. Generate Release Plan
    RP->>Dev: 7. Notify about generated plan
    Dev->>RP: 8. Review Plan
    RP->>MonoRepo: 9. Publish updated package(s) if plan is approved

```

- **1a:** The `Developer` creates a PR for manual package updates.
- **1b:** The `RenovateBot` creates a PR for dependency updates.
- **2:** The `Monorepo` system notifies the `Developer` about the PR w/
  PolicyBot.
- **3:** The `Developer` reviews and merges the PR.
- **4:** The `Developer` adds or modifies the changeset file based on the
  changes made.
- **5:** The `Monorepo` identifies the impacted packages.
- **6:** A `Changeset` is used to generate a `Release Plan`.
- **7:** The `Release Plan` system notifies the `Developer` about the generated
  plan.
- **8:** The `Developer` reviews the plan.
- **9:** If the plan is approved, the `Release Plan` instructs the Monorepo to
  publish the updated package(s).

### Action package updates within application repos

Github actions updater uses a pull mechanism to update custom github actions.
The schedule workflow lives in the application repo and requires the following
permissions (see example
[here](https://github.com/smartcontractkit/releng-go-app/blob/main/.github/workflows/schedule-update-actions.yml)):

- contents: write (make updates to app repo / read tags for .github)
- pull_requests: write (create pull requests in app repo)
- workflows: write (update workflows in app repo)

There are a few ways to reference actions:

- locally: `./actions/ci-lint-go`
- ref (branch/tag): `smartcontractkit/.github/actions/ci-lint-go@main`
- ref (shasum) + comment:
  `smartcontractkit/.github/actions/ci-lint-go@<shasum> # vx.x.x`

If a custom action referenced from this repo includes a comment with a monorepo
tag and valid semver version, it will update to the latest semver version. The
comment should be in this format: `# <action-name>@<action-version>`. (see
monorepo tags [here](https://github.com/smartcontractkit/.github/tags)) Any
other non-semver reference is ignored. For example:

- action used in workflow (before):

```yaml
uses: smartcontractkit/.github/actions/ci-lint-go@<shasum-before> # ci-lint-go@x.x.x
```

- action used in workflow (after):

```yaml
uses: smartcontractkit/.github/actions/ci-lint-go@<shasum-after> # ci-lint-go@x.x.y
```

To bootstrap an action to accept action updates, add `# @0.0.0` with any valid
reference and the action updater will update at the next scheduled run.

```yaml
uses: smartcontractkit/.github/actions/ci-lint-go@<any-valid-ref> # @0.0.0
```

## Example Usage

### Golden path example repositories

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

## Development

### Creating a new action

To create a new action within this repository, use the nx plugin generator to
bootstrap by running and following the prompts:

```sh
# install dependencies
➜ pnpm install

# generate a new github action
➜ pnpm nx generate nx-chainlink:create-gh-action

>  NX  Generating nx-chainlink:create-gh-action

✔ What name would you like to use? · name-of-your-action
✔ What description would you like to use? · some description of your action
CREATE actions/name-of-your-action/project.json
CREATE actions/name-of-your-action/README.md
CREATE actions/name-of-your-action/action.yml
CREATE actions/name-of-your-action/debug.sh
CREATE actions/name-of-your-action/package.json
UPDATE tsconfig.base.json
```

Note: This will bootstrap a new composite action within the `actions/` with the
minimum required files.
