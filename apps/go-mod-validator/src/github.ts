import { Octokit } from "octokit";

async function getDefaultBranch(
  owner: string,
  repo: string,
  octokitClient: Octokit,
): Promise<string> {
  const repoObject = await octokitClient.request(
    `GET /repos/${owner}/${repo}/`,
  );
  return repoObject.data.default_branch;
}

async function findCommitInDefaultBranch(
  owner: string,
  repo: string,
  defaultBranch: string,
  commitSha: string,
  octokitClient: Octokit,
) {
  const compareResult = await octokitClient.request(
    `GET /repos/${owner}/${repo}/compare/${defaultBranch}...${commitSha}`,
  );
  return (
    compareResult.data.status === "identical" ||
    compareResult.data.status === "behind"
  );
}

async function findTagInDefaultBranch(
  owner: string,
  repo: string,
  defaultBranch: string,
  tag: string,
  octokitClient: Octokit,
) {
  const repoTags = await octokitClient.request(
    `GET /repos/${owner}/${repo}/tags`,
  );
  for (const repoTag of repoTags.data) {
    if (repoTag.name != tag) {
      continue;
    }

    // check commit is on the default branch
    return await findCommitInDefaultBranch(
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

export async function validateDependency(
  path: string,
  version: string,
  octokitClient: Octokit,
) {
  // repo format smartcontractkit/chainlink
  const repoPathSplit = path.split("/");
  const owner = repoPathSplit[1];
  const repo = repoPathSplit[2];

  const defaultBranch = await getDefaultBranch(owner, repo, octokitClient);

  const result = await getVersionType(version);
  if (result?.commitSha) {
    return await findCommitInDefaultBranch(
      owner,
      repo,
      defaultBranch,
      result.commitSha,
      octokitClient,
    );
  }
  if (result?.tag) {
    return await findTagInDefaultBranch(
      owner,
      repo,
      defaultBranch,
      result.tag,
      octokitClient,
    );
  }

  return false;
}
