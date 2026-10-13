---
"reusable-dependabump": patch
---

Skip `post-bump-command` when the bump step changes no files, so commands that create files (e.g. a changeset) don't open a PR with nothing to fix
