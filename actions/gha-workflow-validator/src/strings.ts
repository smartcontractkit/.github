export const VALIDATOR_IGNORE_LINE = "ghv-ignore!";
export const FIXING_ERRORS = `


This CI step validates Github Actions workflows. If invoked by a pull request, it will only operate on the changed files.

It currently validates: Actions References, Actions Runner Types

### Fixing Errors

<details>
<summary>Action References (sha-ref, version-comment, node-version) </summary>

This validation is required to ensure that the action references use immutable SHAs, have a version comment, and are not using node16 or earlier.

The proper format for referencing a Github Action external to the repository is as follows:

\`<owner>/<repo>/<optional path>@<commit SHA> # <version tag relating to the SHA>\`

<details>
<summary>Examples</summary>

\`\`\`
actions/cache@ab5e6d0c87105b4c9c2047343972218f562e4319 # v4.0.1

smartcontractkit/chainlink-github-actions/github-app-token-issuer@5874ff7211cf5a5a2670bb010fbff914eaaae138 # v2.3.12
\`\`\`
</details>

##### <ref> is not a valid SHA

* Please reference a specific commit. This is because tags are mutable and pose a security risk
* Do not use things like \`@main\`, \`@branch/feature\`, \`@v4\`, or \`@v4.0.0\`.

##### No version comment found

* Ensure you have left a comment indicating the git tag (or version) associated with the SHA reference.
* \`@<commit> # v4.0.0\`

##### Action is using node...

* The action added is supposed to be run using a version that is not \`node20\`. This might create issues due to Github deprecating actions using \`node16\` and earlier.

</details>

<details>
<summary>Actions Runners (runners)</summary>

This validation is required to limit the cost of high cost runners. See [Github Actions Runner Guidance](https://smartcontract-it.atlassian.net/l/cp/Rw0Gc08x).

##### Actions runner is to expensive

* Consider using a smaller runner type. This will help reduce the cost of the Github Actions workflow.
* If using macOs runners, consider using ubuntu runners instead.
* If you must use an upgraded runner then see Ignoring Errors section below.

</details>

### Ignoring Errors

You can use the following string to ignore a line from validation \`${VALIDATOR_IGNORE_LINE}\` (must be inlined).

When adding this it will trigger an error, this is expected. Please reach out to \`#team-releng\` for approval and bypass.

<details>
<summary>Examples</summary>

\`\`\`
runs-on: ubuntu-latest-99cores-999GB # ${VALIDATOR_IGNORE_LINE}

uses: org/action@sha # v1.0.0-node16 ${VALIDATOR_IGNORE_LINE}
\`\`\`
</details>
`;

export function htmlLink(text: string, url: string) {
  return `<a href="${url}">${text}</a>`;
}
