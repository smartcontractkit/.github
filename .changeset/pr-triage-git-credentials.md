---
"reusable-pr-triage": patch
"pr-triage": patch
---

Keep the checkout's git credential so `pr-triage` can fetch the base and head
refs. With `persist-credentials: false`, the CLI's own `git fetch` ran
unauthenticated and every run failed before analysis.
