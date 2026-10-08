---
"advanced-triggers": minor
"apidiff-go": minor
"changed-modules-go": minor
"changed-roots": minor
"ci-grafana-alert-test": minor
"cicd-changesets-check": minor
"codeowners-review-analysis": minor
"codeowners-sanity-check": minor
"delete-deployments": minor
"get-latest-tag": minor
"get-refs-from-pr-body": minor
"gha-workflow-validator": minor
"matrix-job-check": minor
"semver-compare": minor
"go-conditional-tests": minor
"go-mod-validator": minor
"update-action-versions": minor
"jira-tracing": minor
---

Dependency modernization sweep: `@actions/core` v3, `@actions/github` v9, `@actions/glob` v0.7, `@octokit/types` v18, TypeScript 6, Vitest 5, and Node types 26; dist bundles rebuilt. Root toolchain: Node 26.10.0, pnpm 12.9.1, Nx 23.3, ESLint 9 flat config.

`jira-tracing` migrated to the jira.js v6 API (`createCloudClient`, `auth` basic auth shape, `searchIssues`, `addComment` `body` param).

Following the convention of the node24 sweep (#1505), released as minor. No `action.yml` input/output contracts changed.
