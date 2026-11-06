---
"autofix": minor
"reusable-autofix": minor
---

add `go-changed-only` to run the Go fixers only in modules a pull request
changed (every module when it changes `.github`, `go.work`, a golangci-lint
config, or `go-all-paths`), and `golangci-lint` to run
`golangci-lint run --fix`, committing its fixes and failing on the issues it
can't fix, listed in the job summary
