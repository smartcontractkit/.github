---
"setup-golang": minor
---

Add ability to skip cache uploads while still allowing downloads via new
`skip-cache-save` input parameter. This is particularly useful for merge queue
runs where you want to use existing caches but prevent creating new ones.
