---
"autofix": minor
"reusable-autofix": minor
---

add `golangci-lint-new-only`, on by default, to lint only the issues a pull
request added, by fetching its merge base and passing `--new-from-rev`; set it
to `false` to lint every issue
