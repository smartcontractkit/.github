import fetch from "node-fetch";
import { parse } from "node-html-parser";

async function getDefaultBranch(
  repo: string,
  accessToken: string,
): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${repo}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const response = await fetch(apiUrl, { headers });
  if (!response.ok) {
    throw new Error(
      `failed to find default branch: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.default_branch;
}

// TODO: there's no perfect way of finding the branches the commit belongs to in github.
// Temporarily, parsing the html output of an undocumented API here.
async function findCommitInDefaultBranch(
  repo: string,
  defaultBranch: string,
  commitSha: string,
  accessToken: string,
) {
  const url = `https://www.github.com/${repo}/branch_commits/${commitSha}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `failed to find commit in default branch: ${response.status} - ${response.statusText}`,
    );
  }
  const responseText = await response.text();

  const dom = parse(responseText);
  const branchElements = dom.querySelectorAll(".branches-list .branch a");

  for (const element of branchElements) {
    if (element.textContent == defaultBranch) {
      return true;
    }
  }

  return false;
}

async function findTagInDefaultBranch(
  repo: string,
  defaultBranch: string,
  tag: string,
  accessToken: string,
) {
  const url = `https://api.github.com/repos/${repo}/tags`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `failed to find tag in default branch: ${response.status} - ${response.statusText}`,
    );
  }

  const repoTags = await response.json();
  for (const repoTag of repoTags) {
    if (repoTag.name != tag) {
      continue;
    }

    // check commit is on the default branch
    return await findCommitInDefaultBranch(
      repo,
      defaultBranch,
      repoTag.commit.sha,
      accessToken,
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
  accessToken: string,
) {
  // repo format smartcontractkit/chainlink
  const repoPathSplit = path.split("/");
  const repo = `${repoPathSplit[1]}/${repoPathSplit[2]}`;

  const defaultBranch = await getDefaultBranch(repo, accessToken);

  const result = await getVersionType(version);
  if (result?.commitSha) {
    return await findCommitInDefaultBranch(
      repo,
      defaultBranch,
      result.commitSha,
      accessToken,
    );
  }
  if (result?.tag) {
    return await findTagInDefaultBranch(
      repo,
      defaultBranch,
      result.tag,
      accessToken,
    );
  }

  return false;
}
