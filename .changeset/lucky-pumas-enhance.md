---
"enhance-dependabot": major
---

initial versioned release of the enhance-dependabot action, which makes Dependabot PRs actionable by running a repository-defined enhancement command on the checked-out PR head, committing the result, and pushing it back to the same Dependabot branch with an isolated push token (a GitHub App token makes the push trigger the repository's usual checks; GITHUB_TOKEN pushes do not create workflow runs)
