---
"setup-nodejs": minor
---

Removed default value from `pnpm-version` input (was originally ^10.0.0), this is now a fallback default.

The action will determine what version to use through the following means:
1. If `pnpm-version` was explicitly passed, it will use that
2. If not passed, it will attempt to pull the version from the `.tool-versions` file
3. If this file doesn't exist, or doesn't declare `pnpm` then it will default to `^10.0.0`.
