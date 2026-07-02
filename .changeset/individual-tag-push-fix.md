---
"changesets-signed-commits": patch
---

Push Changesets release tags one at a time instead of `git push origin --tags`.
GitHub suppresses push webhooks when more than three tags are pushed at once,
which prevented tag-triggered service CI from running on multi-package releases.
