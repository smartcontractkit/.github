---
"changesets-signed-commits": minor
---

`commitAll` now runs `git status --untracked-files=all`, so untracked files inside untracked directories are committed too. Unreadable paths (missing files, directories, symlinks to directories) are now skipped with a warning instead of failing the run — previously a missing or unreadable path in the status output crashed the commit. Also bumps `@actions/*` SDKs to latest majors; dist rebuilt.
