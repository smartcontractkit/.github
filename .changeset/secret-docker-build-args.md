---
"reusable-docker-build-publish": minor
---

feat: add optional DOCKER_BUILD_ARGS secret to pass sensitive build args (e.g. BASE_IMAGE referencing a private ECR account ID) that cannot be supplied via the non-secret docker-build-args input on workflow_call
