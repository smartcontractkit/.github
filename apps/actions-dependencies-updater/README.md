# Actions Dependencies Updater

This tool has two main purposes:

1. Checking if your workflows rely (directly or transitively) on any node12 or
   node16 actions.
2. Updating all actions within a repo's workflows to the newest tag/release for
   that action.

## Setup

Have [`pnpm`](https://pnpm.io/) and [`direnv`](https://direnv.net/) setup.

1. Install Dependencies

```bash
pnpm install
```

2. Populate a `.envrc` file within this project's directory

```bash
# Requires "repo" access, and authorized to read the repo(s) you are testing.
export GH_ACCESS_TOKEN="<Github PAT>"
```

3.  `direnv allow`

## Usage

```
# Help Menu
pnpm start --help

# Basic Execution
pnpm start --repo-dir=<path to repository>
```

### Notes

- When updating action references, it will update them in batches and (by
  default) perform `git commit` for you.
  - If you have setup commit signing, you will be required to sign commits as
    you usually do.

### Examples

- Update all actions, adn check for node12/node16 action dependencies before and
  after the update

  - ` pnpm start --repo-dir=/Users/user/repos/chainlink`

- Update all actions, adn check for node12/node16 action dependencies before and
  after the update, but don't create a local branch, and don't commit anything

  - ` pnpm start --repo-dir=/Users/user/repos/chainlink --no-branch --no-commit`

- Only check for deprecated action dependencies, and perform no updates
  - ` pnpm start --repo-dir=/Users/user/repos/chainlink --check-deprecated`
