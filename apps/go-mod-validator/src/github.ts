import * as github from "@actions/github";

export type Octokit = ReturnType<typeof github.getOctokit>;

async function getDefaultBranch(
  owner: string,
  repo: string,
  octokitClient: Octokit,
): Promise<string> {
  const repoObject = await octokitClient.rest.repos.get({ owner, repo });
  return repoObject.data.default_branch;
}

async function isCommitInDefaultBranch(
  owner: string,
  repo: string,
  defaultBranch: string,
  commitSha: string,
  octokitClient: Octokit,
): Promise<boolean> {
  const compareResult = await octokitClient.rest.repos.compareCommits({
    repo: repo,
    owner: owner,
    base: defaultBranch,
    head: commitSha,
  });
  return (
    compareResult.data.status === "identical" ||
    compareResult.data.status === "behind"
  );
}

async function isTagInDefaultBranch(
  owner: string,
  repo: string,
  defaultBranch: string,
  tag: string,
  octokitClient: Octokit,
): Promise<boolean> {
  const repoTags = await octokitClient.rest.repos.listTags({ owner, repo });
  for (const repoTag of repoTags.data) {
    if (repoTag.name != tag) {
      continue;
    }

    return await isCommitInDefaultBranch(
      owner,
      repo,
      defaultBranch,
      repoTag.commit.sha,
      octokitClient,
    );
  }

  return false;
}

async function getVersionType(versionString: string) {
  // matches pseudo versins like v0.0.5-0.20220116011046-fa5810519dcb
  const pseudoVersionRegex = /-([\d.]*)-([a-f0-9]{12})(?:\+[\w.-]+)?$/;
  // matches real versions like v0.1.0
  const versionRegex = /^(v\d+\.\d+\.\d+)$/;

  const pseudoVersionMatch = versionString.match(pseudoVersionRegex);
  const versionMatch = versionString.match(versionRegex);

  if (pseudoVersionMatch) {
    return {
      commitSha: pseudoVersionMatch[2],
      tag: null,
    };
  }
  if (versionMatch) {
    return {
      commitSha: null,
      tag: versionMatch[1],
    };
  }
}

// parses the dependency path and version to verify if the corresponding
// tag/commit is present on the default branch of the dependency.
export async function validateDependency(
  path: string,
  version: string,
  octokitClient: Octokit,
) {
  // repo format github.com/smartcontractkit/chainlink
  const [, owner, repo] = path.split("/");

  const defaultBranch = await getDefaultBranch(owner, repo, octokitClient);

  const result = await getVersionType(version);
  if (result?.commitSha) {
    return await isCommitInDefaultBranch(
      owner,
      repo,
      defaultBranch,
      result.commitSha,
      octokitClient,
    );
  }
  if (result?.tag) {
    return await isTagInDefaultBranch(
      owner,
      repo,
      defaultBranch,
      result.tag,
      octokitClient,
    );
  }

  return false;
}
