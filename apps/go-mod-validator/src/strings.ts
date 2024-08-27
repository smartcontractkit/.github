export const FIXING_ERRORS = `
#### Fixing Errors

<details>
<summary>Instructions</summary>

Types of Errors:

1. Dependency not on default branch - Check for the dependency's commit on the upstream repository and use one of the commits from the default branch of the upstream repository. 

NOTE: If you see that the commit should be on the default branch, but it isn't, this means that the "default branch" setting of the repository is incorrect. Please update the default branch of the repository to the correct branch.

e.g., 
- For dependency github.com/smartcontractkit/grpc-proxy@v0.1.0, upstream repository is \`github.com/smartcontractkit/grpc-proxy\` and \`v0.1.0\` is the tag that produced the dependency, which isn't created from the default branch.
  Update it to use one of the tags from the default repository using \`go mod tidy\`.
- For dependency github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16, upstream repository is \`github.com/smartcontractkit/go-plugin\` and \`b3b91517de16\` is the commit that produced the dependency, which isn't on the default branch.
  Update it to use one of the commits from the default repository using \`go mod tidy\`. Ideally we should update it to use a tag like the example above.

</details>
`;
