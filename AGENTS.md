# Agents

This repo is the `smartcontractkit/.github` monorepo: reusable GitHub Actions
and workflows, versioned with changesets.

## Layout

- `actions/<name>/` — reusable actions. Each has `action.yml`, `package.json`,
  `CHANGELOG.md`, and `README.md`. TypeScript actions also have `src/` and a
  committed `dist/` built by nx/esbuild.
- `workflows/<name>/` — reusable workflow sources. Edit the source here, never
  the copy in `.github/workflows/`; lefthook syncs it. Details:
  `workflows/README.md`.
- `apps/`, `libs/` — TypeScript apps and nx plugins.

## Writing actions

- Heavily prefer TypeScript over bash. Use bash only when it is clearly the
  winner for simplicity and understandability.
- Pass `${{ }}` values into `run:` scripts through `env:`. Inline interpolation
  in `run:` is a script-injection vector.
- Write step outputs with `| tee -a "$GITHUB_OUTPUT"` instead of
  `>> "$GITHUB_OUTPUT"`, so they also appear in the log.
- Pin third-party actions to a full-length commit SHA.
- Give actions the least access they need. Take tokens as explicit inputs rather
  than relying on ambient permissions.
- TypeScript actions: `main` points at `dist/index.js`, and the built `dist/` is
  committed. Lefthook rebuilds affected projects on commit.

## Versioning

Add a changeset (`.changeset/*.md`) for any user-facing change to an action or
workflow. Merges to `main` bump the `package.json` versions and create git tags;
callers reference those tags.

## Verify

- `pnpm lint:affected`, `pnpm test:affected`, `pnpm build:affected` — nx targets
  for changed projects. Full list: `package.json` scripts.
- `pnpm workflows:check` — reusable workflow sync is up to date.
- Lefthook runs prettier, actionlint, shellcheck, and affected builds
  pre-commit.

## PR size

Keep PRs under 400 added lines of authored code and config; deletions don't
count. Code counts whether a human or an agent wrote it. Tool-generated files
(codegen output, lockfiles, test snapshots) and tests don't count toward the
limit, but tests must only cover code changed in the PR; don't expand test scope
to work around the limit.

If a task can't fit in 400 lines:

1. Default: stop and propose a split before writing code.
2. If asked to work autonomously: split the work into layers and stage them one
   layer at a time, pausing for the developer to commit each.
3. Once the commits are signed, ASK the developer if they want you to create the
   stack. IF they say yes, built a stack with
   [gh-stack](https://github.github.com/gh-stack/) —
   `gh extension install github/gh-stack`, `gh stack init <name>` for the first
   layer, `gh stack add <name>` for each layer above it, `gh stack push` /
   `gh stack submit` to open the PRs. It handles cascading rebases when a lower
   layer changes.
4. If gh-stack can't be installed, stack manually: branch each PR off the
   previous one, target it there (`gh pr create --base <prev-branch>`), and note
   the stack order in each PR description.

Exempt: dependency bumps, mass renames, `git mv` refactors, reverts, release
PRs. _Add categories here if a PR type becomes untenable under the limit._
