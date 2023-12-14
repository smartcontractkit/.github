# ADR: Generation of Build Artifacts

## Context

Our team required a method to handle artifact generation.

This repository contains Github actions (GHA) written in YAML and Typescript.

- YAML-declared actions are interpreted directly by the GHA runner during
  execution.
- TypeScript-written actions require compilation to JavaScript, enabling the GHA
  runner to invoke them. This necessitates committing build artifacts to the
  repository so they can be run immediately.

### Considered Workflows

We considered two different workflows for executing on pull requests (PRs):

- **Workflow 1**: A workflow which generates build artifacts and commits them to the
  PR that triggered the workflow. This approach ensures that the latest changes
  are always included in the PR, and subsequently on the target branch after
  merge.
- **Workflow 2**: A workflow which generates build artifacts and compares these
  artifacts with those included in the PR. Only passing if build artifacts are
  the same. This method ensures consistency and integrity of the build artifacts
  but requires manual intervention to resolve discrepancies.

# Decision

We will include automated PR workflows to generate build artifacts and commit
these artifacts back to the PR. (workflow 1).

**Advantages**:

- Automation: Streamlines the process by automating artifact generation and
  committing.
- Up-to-date Artifacts: Ensures that the latest changes are always reflected in
  the PR.
- Simplicity: Reduces the complexity for developers by handling the build
  process within CI.
- Consistency: Consistent environment producing build artifacts.
- Security: Automated builds minimize the risk of human error and reduce the
  likelihood of malicious code being introduced into the build artifacts.

**Disadvantages**:

- Commit Volume: May lead to an increased number of commits in the PR,
  potentially causing clutter.
- Transparency: The automated process might not be immediately clear to all
  contributors.

# Consequences

We aim to improve the efficiency and reliability of our CI/CD process for GitHub
Actions. It will allow developers to focus more on development rather than the
build process, though it may require some adaptation in terms of managing PRs
and understanding the automated processes involved.
