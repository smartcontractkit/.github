# Actions Dependencies Updater

This tool has two main purposes:

1. Checking if your workflows rely (directly or transitively) on any node12 or
   node16 actions.
2. Updating all actions within a repo's workflows to the newest tag/release for
   that action.

## Setup

1. Install and setup tooling

   - [`pnpm`](https://pnpm.io/)

2. Install Dependencies
   ```bash
    pnpm install
   ```
3. Generate a Github Personal Access Token with repo access
   - This ideally has read access to all actions used in your workflow files
4. Populate a `.env` file within this project's directory
   ```bash
   GH_ACCESS_TOKEN="<Github PAT>"
   ```

## Usage

```
# Help Menu
pnpm start --help

# Basic Execution
pnpm start --repo-dir=<path to repository>
```

### Notes

- This makes no remote changes, all changes are local only. This means you are
  required to push the branch and open a PR for these changes.
- When updating action references, it will update them in batches and (by
  default) perform `git commit` for you.
  - If you have setup commit signing, you will be required to sign commits as
    you usually do.
- If you're _not_ using `direnv` then you will need to export or inline the
  `GH_ACCESS_TOKEN` environment variable.
  - For example: `GH_ACCESS_TOKEN="<pat>" pnpm start ...`

### Examples

- Update all actions, and check for node12/node16 action dependencies before and
  after the update

  - `pnpm start --repo-dir=/Users/user/repos/chainlink`

- Update all actions, and check for node12/node16 action dependencies before and
  after the update, but don't create a local branch, and don't commit anything

  - `pnpm start --repo-dir=/Users/user/repos/chainlink --no-branch --no-commit`

- Only check for deprecated action dependencies, perform no updates
  - `pnpm start --repo-dir=/Users/user/repos/chainlink --skip-updates`
