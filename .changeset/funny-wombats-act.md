---
"setup-nodejs": major
---

feat: add pnpm-version-file input, now able to extract the version from
.tool-versions directly. This is now the default functionality.

If you require setting a specific version from the workflow, or if you don't a .tool-versions
file, then you must explicitly pass a value for `pnpm-version`. ie. `9.1.2` or `^10.0.0`
