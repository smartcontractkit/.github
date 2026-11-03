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
