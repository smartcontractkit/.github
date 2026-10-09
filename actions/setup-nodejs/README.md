# setup-nodejs action

Sets up nodejs and pnpm.

## Determining node version

The action will determine what version to use through the following means:

1. If `node-version` was explicitly passed, it will use that
2. If not passed, it will check the `node-version-file` input:
   - For a mise file (`mise.toml`, `.mise.toml`, or `.config/mise/config.toml`),
     it reads the `node` version from the `[tools]` table itself
   - For `.tool-versions` or `.nvmrc`, the file is forwarded to `setup-node`,
     which parses it natively
3. If `node-version-file` is not passed, it auto-detects: a mise file first,
   then `.tool-versions` or `.nvmrc`
4. If no file is found, `setup-node` falls back to its own default

## Determining pnpm version

The action will determine what version to use through the following means:

1. If `pnpm-version` was explicitly passed, it will use that
2. If not passed, it will attempt to pull the version from the same mise file as
   node (`mise.toml`, `.mise.toml`, or `.config/mise/config.toml`)
3. If not found there, it will pull the version from a `.tool-versions` file
4. If this file doesn't exist, or doesn't declare `pnpm` then it will default to
   `^12.0.0`

## mise

If a mise config file is present, the action also runs
[`mise install`](https://mise.jdx.dev/) so every tool pinned in `mise.toml`
(e.g. `shellcheck`) is available to subsequent steps — the same toolchain a
developer gets locally. Repos without a mise config skip this entirely.
