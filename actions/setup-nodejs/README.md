# setup-nodejs action

Sets up nodejs and pnpm.

## Determining pnpm version

The action will determine what version to use through the following means:

1. If `pnpm-version` was explicitly passed, it will use that
2. If not passed, it will attempt to pull the version from the `.tool-versions`
   file
3. If this file doesn't exist, or doesn't declare `pnpm` then it will default to
   `^10.0.0`.
