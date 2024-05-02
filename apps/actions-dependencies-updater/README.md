# Actions Dependencies Updater

This tool has two main purposes:
1. Checking if your workflows rely (directly or transitively) on any node12 or node16 actions.
2. Updating all actions within a repo's workflows to the newest tag/release for that action.

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
pnpm start --help
```

### Example

` pnpm start --repo-dir=/Users/erik/Documents/repos/chainlink`
