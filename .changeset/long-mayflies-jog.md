---
"policy-bot-config-validator": major
---

Upgraded to work with GAP v2.

Breaking changes:
* input `api-gateway-host` was removed
* two new inputs `k8s-cluster-name` and `main-dns-zone` were added as required when `setup-gap` is `true`