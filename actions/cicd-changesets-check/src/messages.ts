import { CHANGESET_SIGNATURE } from "./github";

export function getAbsentMessage(
  commitSha: string,
  addChangesetUrl: string,
): string {
  return `### 💥 No Changeset

Latest commit: ${commitSha}

Merging this PR will not cause any packages to be released. If these changes should not cause updates to packages in this repo, this is fine 🙂

**If these changes should be published to npm, you need to add a changeset.**

[Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).

[Click here if you're a maintainer who wants to add a changeset to this PR](${addChangesetUrl})

${CHANGESET_SIGNATURE}`;
}

export function getApproveMessage(commitSha: string): string {
  return `### 🦋 Changeset is good to go

Latest commit: ${commitSha}

**We got this.**

Not sure what this means? [Click here to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).

${CHANGESET_SIGNATURE}`;
}
