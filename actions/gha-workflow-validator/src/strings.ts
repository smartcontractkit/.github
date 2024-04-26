export const FIXING_ERRORS = `
#### Fixing Errors

<details>
<summary>Instructions</summary>

The proper format for referencing a Github Action external to the repository is as follows:

\`<owner>/<repo>/<optional path>@<commit SHA> # <tag relating to the SHA>\`

<details>
<summary>Examples</summary>

\`\`\`
actions/cache@ab5e6d0c87105b4c9c2047343972218f562e4319 # v4.0.1

smartcontractkit/chainlink-github-actions/github-app-token-issuer@5874ff7211cf5a5a2670bb010fbff914eaaae138 # v2.3.12
\`\`\`
</details>

##### <ref> is not a valid SHA

* Please reference a specific commit.
* Do not use things like \`@main\`, \`@branch/feature\`, \`@v4\`, or \`@v4.0.0\`.

##### No version comment found

* Ensure you have left a comment indicating the git tag (or version) associated with the SHA reference.
* \`@<commit> # v4.0.0\`

##### Action is using node...

* The action added is supposed to be run using a version that is not \`node20\`. This might create issues due to Github deprecating actions using \`node16\` and earlier.

</details>
`

export function collapsibleContent(title: string, content: string) {
  return `
<details>
<summary>${title}</summary>

${content}

</details>
`
}

export function htmlLink(text: string, url: string) {
  return `<a href="${url}">${text}</a>`
}
