---
"setup-github-token": minor
---

feat: retry the GATI v2 token request. The new `retries` input (default `2`) is
passed to invoke-gati-v2 for network errors, 429 and 5xx responses, and a first
request that fails for any other reason, such as an empty 200 response, is made
once more before the action fails.
