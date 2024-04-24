---
"ci-test-go": patch
---

Add pipefail to go test call so any pipes to tee or other programs will still
fail when go test fails
