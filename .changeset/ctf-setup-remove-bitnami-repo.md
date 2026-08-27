---
"ctf-setup-run-tests-environment": minor
---

Remove the Bitnami Helm chart repo from test env setup. The action no longer runs `helm repo add bitnami`; CTF charts are provided through the `chainlink-qa` repository. Tests that still require a Bitnami chart must add their own non-Bitnami source.
