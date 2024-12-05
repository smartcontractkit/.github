---
"crib-deploy-environment": major
---

WHAT: Building CLI only when changes are detected.
WHY: This is required so we can push new changes to the CLI and have them tested against the version we're actually pushing. This is backwards-incompatible because it requires the `pull-requests: read` permission

### Action required

When upgrading, make sure you add: `pull-requests: read` to your permission set. Otherwise you should see an error like `Error: Resource not accessible by integration`.
