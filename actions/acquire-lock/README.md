# Acquire Lock Action

A GitHub Action that implements a distributed locking mechanism for coordinating
deployments across multiple pull requests. This action prevents concurrent
deployments by using Git branches as locks.

## Overview

This action provides a simple yet effective way to ensure only one PR can deploy
at a time by creating a lock branch in the repository. If a lock is already held
by another PR, subsequent deployment attempts are blocked until the lock is
released.

## Features

- **Branch-based locking**: Uses Git branches as a reliable distributed lock
  mechanism
- **Re-entrant locking**: Same PR can re-acquire its own lock when workflows are
  re-run
- **PR comments**: Automatically posts comments to blocked PRs explaining who
  holds the lock
- **Status checks**: Creates GitHub Check Runs to show lock status in the PR UI
- **Easy cleanup**: Locks are released using the [release-lock](../release-lock)
  action or by deleting the lock branch

## Inputs

| Input  | Required | Default | Description                                                    |
| ------ | -------- | ------- | -------------------------------------------------------------- |
| `lock` | Yes      | -       | The name of the lock to acquire (usually the lock branch name) |
| `pr`   | No       | `""`    | The pull request number to use for the lock branch             |

## Outputs

| Output          | Description                                               |
| --------------- | --------------------------------------------------------- |
| `lock_acquired` | Returns `'true'` if the lock was acquired, else `'false'` |
| `lock_owner`    | The owner of the lock, the PR number                      |

## Usage

### Basic Example

```yaml
name: Deploy
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for lock branch operations

      - name: Acquire deployment lock
        uses: ./.github/actions/acquire-lock
        with:
          lock: global-deploy-lock
          pr: ${{ github.event.pull_request.number }}

      - name: Deploy application
        run: |
          echo "Deploying application..."
          # Your deployment steps here
```

### Recommended: Combined Workflow with Release-Lock Action

The recommended approach is to use the [release-lock](../release-lock) action to
automatically release locks when PRs are closed:

```yaml
name: Deploy with Lock Management
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  deploy:
    if: github.event.action != 'closed'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      checks: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Acquire deployment lock
        uses: ./.github/actions/acquire-lock
        with:
          lock: global-deploy-lock
          pr: ${{ github.event.pull_request.number }}

      - name: Deploy application
        run: |
          echo "Deploying application..."
          # Your deployment steps here

  release-lock:
    if: github.event.action == 'closed'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Release deployment lock
        uses: ./.github/actions/release-lock
        with:
          lock: global-deploy-lock
```

### Alternative: Manual Lock Release

You can also release the lock manually within the same workflow:

```yaml
name: Deploy to Production
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      checks: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Acquire deployment lock
        id: lock
        uses: ./.github/actions/acquire-lock
        with:
          lock: production-deploy-lock
          pr: ${{ github.event.pull_request.number }}

      - name: Deploy to production
        if: steps.lock.outputs.lock_acquired == 'true'
        run: |
          echo "Deploying to production..."
          # Your deployment commands

      - name: Release lock after deployment
        if: always() && steps.lock.outputs.lock_acquired == 'true'
        run: |
          git push origin --delete production-deploy-lock || true
```

## How It Works

1. **Lock Check**: The action checks if a lock branch with the specified name
   exists
2. **Lock Held**: If the lock branch exists:
   - Fetches the branch and reads the `LOCK_PR` file to identify the owner
   - If the current PR holds the lock (re-entrant), it proceeds with deployment
   - If another PR holds the lock, it blocks the deployment and creates a failed
     status check
3. **Lock Acquisition**: If no lock exists:
   - Creates a new lock branch
   - Writes the PR number to a `LOCK_PR` file in the branch
   - Pushes the lock branch to the repository
   - Creates a success status check

## Status Checks and Comments

When a lock is blocked, the action will:

- Create or update a PR comment explaining which PR holds the lock
- Create a failed GitHub Check Run named "Deploy Lock Status"
- Exit with code 1 to fail the workflow

When a lock is acquired or already held:

- Create a success GitHub Check Run
- Allow the workflow to continue

## Requirements

- The workflow must have `write` permissions for `contents`, `checks`, and
  `pull-requests`
- The repository must be checked out with sufficient fetch depth (recommend
  `fetch-depth: 0`)

## Permissions

Add these permissions to your workflow:

```yaml
permissions:
  contents: write
  checks: write
  pull-requests: write
```

## Troubleshooting

### Lock not being released

If a lock branch is not deleted after a deployment:

- Use the [release-lock](../release-lock) action to properly release the lock
- Manually delete the lock branch: `git push origin --delete <lock-name>`
- Ensure you're using the combined workflow pattern shown above

### Permission denied errors

Ensure your workflow has the required permissions:

```yaml
permissions:
  contents: write
  checks: write
  pull-requests: write
```

### Lock branch conflicts

If multiple PRs try to create the same lock simultaneously, Git's atomic branch
creation ensures only one succeeds. The others will be blocked as expected.

## Related Actions

- [release-lock](../release-lock) - Release a deployment lock when a PR is
  closed

## License

MIT

## Author

@smartcontractkit
