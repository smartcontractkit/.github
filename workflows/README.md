# Reusable Workflows

The original source of our reusable workflows are stored in sub-directories
here. This is to support versioning.

## Versioning

This monorepo uses `changesets` to version workflows, actions, etc. Changesets
relies on a dedicated directory with a `package.json` and a `CHANGELOG.md` to
version a specific "thing".

So here, we have directories that contain:

- The workflow yaml file
- `package.json` (naming and versioning)
- `CHANGELOG.md`
- `README.md`

- When changeset files (`.changeset/*.md`) are consumed (in CI) it will bump the
  version in the appropriate `package.json` files.
- On every push to `main`, changesets reconciles current action versions (as
  declared in the `package.json` files) with git tags.
  - This effectively creates tags for any versions within the repository that
    don't yet exist as git tags. We use this to version our workflows.

## Syncing

We require "syncing" because:

- Reusable workflows must exist at a repository's `.github/workflows` directory.
- Workflow files cannot be symlinks to a different directory
- `changeset` doesn't detect changes to a package, if the file "modified" is a
  symlink.

So because of this, we require a way to sync workflows from this nested
structure required for versioning, and copying them to `.github/workflows`.

The syncing script is available at `tools/scripts/sync-reusable-workflows.sh`.

### Automatic Syncing

We use `lefthook` for pre-commit hooks, which will run the sync script and error
if there are discrepancies between the source workflow yaml (at
`workflows/<name>/<name>.yml`), and the copied/destination workflow yaml at
`.github/workflows/<name>.yml`.
