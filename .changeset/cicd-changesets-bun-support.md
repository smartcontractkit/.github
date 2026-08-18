---
"cicd-changesets": minor
---

Let a bun repo run its own releases.

The action installed Node and pnpm unconditionally and ran `pnpm install`, so a
repo whose dependencies are managed by bun could not use it: there was no pnpm
lockfile to install from, and `node-version-file` had no `engines.node` to read
in a package.json that pins `engines.bun` instead. It failed at the Node setup
step, before any changesets work.

A new `package-manager` input selects the toolchain. It defaults to `pnpm`, so
every existing caller is unaffected. Set it to `bun` and Node and pnpm are not
installed at all: bun is set up at `bun-version` and
`bun install --frozen-lockfile` runs instead.

`changesets-publish-cmd` and `changesets-version-cmd` now default to
`<package-manager> run ci:changeset:{publish,version}` rather than hard-coding
`pnpm`, so a bun caller that overrides neither does not shell out to a pnpm that
was never installed. A pnpm caller resolves to the same two commands as before.

The `signed-commits` action needed no change. It runs whichever commands it is
given, and bun installs a normal `node_modules` tree, so it resolves
`@changesets/cli/bin.js` exactly as it does under pnpm.
