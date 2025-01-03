---
"crib-deploy-environment": minor
---

Use the latest version of setup-gap with local dynamic proxy

Input parameters changes:

- Renamed:
  - `envoy-github-oidc-token-header-name` -> `envoy-github-oidc-token-header-name`

- Added (not required):
  - `dynamic-proxy-port`

- Added (required):
  - `main-dns-zone`
