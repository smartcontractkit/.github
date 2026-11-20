---
"pr-triage": minor
---

feat: add a `pr-triage` action that downloads a pinned pr-triage Linux release
binary, verifies its SHA-256 checksum against the release checksums, and runs
`pr-triage analyze` with the tokens and flags the caller passes in.
