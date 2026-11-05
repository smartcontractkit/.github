---
"reusable-dependabump": major
---

Add `gati-profile` input to fetch private Go modules with a GATI token, and
`goprivate` to set `GOPRIVATE`. The job now requests `id-token: write`, which
callers must grant.
