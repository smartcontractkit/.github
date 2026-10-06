---
"advanced-triggers": patch
"apidiff-go": patch
"changed-modules-go": patch
"changed-roots": patch
"ci-grafana-alert-test": patch
"cicd-changesets-check": patch
"codeowners-review-analysis": patch
"codeowners-sanity-check": patch
"delete-deployments": patch
"get-latest-tag": patch
"get-refs-from-pr-body": patch
"gha-workflow-validator": patch
"matrix-job-check": patch
"semver-compare": patch
"changesets-signed-commits": patch
"go-conditional-tests": patch
"go-mod-validator": patch
---

Bump nx and @nx/* packages from 22.5.3 to 22.7.7 to remediate CVE-2026-71476 (GHSA-vp3h-ghgh-jr7g), a zip-slip arbitrary file write in the self-hosted HTTP remote cache extractor. Rebuilds affected action artifacts.
