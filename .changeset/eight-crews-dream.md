---
"crib-deploy-environment": patch
---

Moving the step for generating the CRIB namespace and labels before the
setup-gap step allows the namespace name to be passed to the setup-gap step,
which is required for handling WebSockets.
