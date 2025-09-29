---
"setup-golang": patch
---

fix(setup-golang): use path from input

In multiple places, we assume the go.mod and go.sum files are located on the root which is not the case when the project is a monorepo, we should use the path provided in the input instead of assuming
