import { exec, getExecOutput } from "@actions/exec";
import { GitHub, getOctokitOptions } from "@actions/github/lib/utils";
import * as github from "@actions/github";
import * as core from "@actions/core";
import fs from "fs-extra";
import { getPackages, Package } from "@manypkg/get-packages";
import path from "path";
import * as semver from "semver";
import { PreState } from "@changesets/types";
import {
  getChangelogEntry,
  getChangedPackages,
  sortTheThings,
  getVersionsByDirectory,
} from "./utils";
import * as localGitUtils from "./git/local-git";
import * as githubGitUtils from "./git/github-git";
import readChangesetState from "./read-changeset-state";
import resolveFrom from "resolve-from";
import { throttling } from "@octokit/plugin-throttling";

// GitHub Issues/PRs messages have a max size limit on the
// message body payload.
// `body is too long (maximum is 65536 characters)`.
// To avoid that, we ensure to cap the message to 60k chars.
const MAX_CHARACTERS_PER_MESSAGE = 60000;

const setupOctokit = (githubToken: string) => {
  return new (GitHub.plugin(throttling))(
    getOctokitOptions(githubToken, {
      throttle: {
        onRateLimit: (
          retryAfter: number,
          options: any,
          _octokit,
          retryCount: number,
        ) => {
          core.warning(
            `Request quota exhausted for request ${options.method} ${options.url}`,
          );

          if (retryCount <= 2) {
            core.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (
          retryAfter: number,
          options: any,
          _octokit,
          retryCount: number,
        ) => {
          core.warning(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
          );

          if (retryCount <= 2) {
            core.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
      },
    }),
  );
};

const createRelease = async (
  octokit: ReturnType<typeof setupOctokit>,
  { pkg, tagName }: { pkg: Package; tagName: string },
) => {
  try {
    core.debug(
      `Creating release for ${pkg.packageJson.name}@${pkg.packageJson.version}`,
    );
    let changelogFileName = path.join(pkg.dir, "CHANGELOG.md");

    let changelog = await fs.readFile(changelogFileName, "utf8");

    let changelogEntry = getChangelogEntry(changelog, pkg.packageJson.version);
    if (!changelogEntry) {
      // we can find a changelog but not the entry for this version
      // if this is true, something has probably gone wrong
      throw new Error(
        `Could not find changelog entry for ${pkg.packageJson.name}@${pkg.packageJson.version}`,
      );
    }

    await octokit.rest.repos.createRelease({
      name: tagName,
      tag_name: tagName,
      body: changelogEntry.content,
      prerelease: pkg.packageJson.version.includes("-"),
      ...github.context.repo,
    });
  } catch (err) {
    // if we can't find a changelog, the user has probably disabled changelogs
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code !== "ENOENT"
    ) {
      throw err;
    }
  }
};

type PublishOptions = {
  script: string;
  githubToken: string;
  createGithubReleases: boolean;
  tagSeparator: string;
  cwd?: string;
};

type PublishedPackage = { name: string; version: string };

type PublishResult =
  | {
      published: true;
      publishedPackages: PublishedPackage[];
    }
  | {
      published: false;
    };

export async function runPublish({
  script,
  githubToken,
  createGithubReleases,
  tagSeparator,
  cwd = process.cwd(),
}: PublishOptions): Promise<PublishResult> {
  const octokit = setupOctokit(githubToken);

  let [publishCommand, ...publishArgs] = script.split(/\s+/);

  let changesetPublishOutput = await getExecOutput(
    publishCommand,
    publishArgs,
    { cwd },
  );

  await githubGitUtils.pushTags(tagSeparator);

  let { packages, tool } = await getPackages(cwd);
  let releasedPackages: Package[] = [];

  // if we are in a monorepo, then publish multiple packages
  // a "root" tool is a single package repo
  // https://github.com/Thinkmill/manypkg/blob/main/packages/tools/src/RootTool.ts#L17C4-L17C64
  if (tool.type !== "root") {
    let newTagRegex = /New tag:\s+(@[^/]+\/[^@]+|[^/]+)@([^\s]+)/;
    let packagesByName = new Map(packages.map((x) => [x.packageJson.name, x]));

    for (let line of changesetPublishOutput.stdout.split("\n")) {
      let match = line.match(newTagRegex);
      if (match === null) {
        continue;
      }
      let pkgName = match[1];
      let pkg = packagesByName.get(pkgName);
      if (pkg === undefined) {
        throw new Error(
          `Package "${pkgName}" not found.` +
            "This is probably a bug in the action, please open an issue",
        );
      }
      releasedPackages.push(pkg);
    }

    if (createGithubReleases) {
      await Promise.all(
        releasedPackages.map((pkg) =>
          createRelease(octokit, {
            pkg,
            tagName: `${pkg.packageJson.name}${tagSeparator}${pkg.packageJson.version}`,
          }),
        ),
      );
    }
  } else {
    if (packages.length === 0) {
      throw new Error(
        `No package found.` +
          "This is probably a bug in the action, please open an issue",
      );
    }
    let pkg = packages[0];
    let newTagRegex = /New tag:/;

    for (let line of changesetPublishOutput.stdout.split("\n")) {
      let match = line.match(newTagRegex);

      if (match) {
        releasedPackages.push(pkg);
        if (createGithubReleases) {
          await createRelease(octokit, {
            pkg,
            tagName: `v${pkg.packageJson.version}`,
          });
        }
        break;
      }
    }
  }

  if (releasedPackages.length) {
    return {
      published: true,
      publishedPackages: releasedPackages.map((pkg) => ({
        name: pkg.packageJson.name,
        version: pkg.packageJson.version,
      })),
    };
  }

  return { published: false };
}

const requireChangesetsCliPkgJson = (cwd: string) => {
  try {
    return require(resolveFrom(cwd, "@changesets/cli/package.json"));
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "MODULE_NOT_FOUND"
    ) {
      throw new Error(
        `Have you forgotten to install \`@changesets/cli\` in "${cwd}"?`,
      );
    }
    throw err;
  }
};

type GetMessageOptions = {
  hasPublishScript: boolean;
  fullRepo: string;
  branch: string;
  changedPackagesInfo: {
    highestLevel: number;
    private: boolean;
    content: string;
    header: string;
  }[];
  prBodyMaxCharacters: number;
  preState?: PreState;
};

export async function getVersionPrBody({
  hasPublishScript,
  preState,
  changedPackagesInfo,
  prBodyMaxCharacters,
  fullRepo,
  branch,
}: GetMessageOptions) {
  let messageHeader = `This PR was opened by the [Changesets release](https://github.com/changesets/action) GitHub action. When you're ready to do a release, you can merge this and ${
    hasPublishScript
      ? `the packages will be published to npm automatically`
      : `publish to npm yourself or [setup this action to publish automatically](https://github.com/changesets/action#with-publishing)`
  }. If you're not ready to do a release yet, that's fine, whenever you add more changesets to ${branch}, this PR will be updated.
`;
  let messagePrestate = !!preState
    ? `⚠️⚠️⚠️⚠️⚠️⚠️

\`${branch}\` is currently in **pre mode** so this branch has prereleases rather than normal releases. If you want to exit prereleases, run \`changeset pre exit\` on \`${branch}\`.

⚠️⚠️⚠️⚠️⚠️⚠️
`
    : "";
  let messageReleasesHeading = `# Releases`;

  let fullMessage = [
    messageHeader,
    messagePrestate,
    messageReleasesHeading,
    ...changedPackagesInfo.map((info) => `${info.header}\n\n${info.content}`),
  ].join("\n");

  // Check that the message does not exceed the size limit.
  // If not, omit the changelog entries of each package.
  if (fullMessage.length > prBodyMaxCharacters) {
    fullMessage = [
      messageHeader,
      messagePrestate,
      messageReleasesHeading,
      `\n> The changelog information of each package has been omitted from this message, as the content exceeds the size limit.\n
To view the full changelog, please check the [CHANGELOG file](https://github.com/${fullRepo}/blob/changeset-release/${branch}/CHANGELOG.md).\n`,
      ...changedPackagesInfo.map((info) => `${info.header}\n\n`),
    ].join("\n");
  }

  // Check (again) that the message is within the size limit.
  // If not, omit all release content this time.
  if (fullMessage.length > prBodyMaxCharacters) {
    fullMessage = [
      messageHeader,
      messagePrestate,
      messageReleasesHeading,
      `\n> All release information have been omitted from this message, as the content exceeds the size limit.`,
    ].join("\n");
  }

  return fullMessage;
}

type VersionOptions = {
  script?: string;
  githubToken: string;
  cwd?: string;
  prTitle?: string;
  commitMessage?: string;
  prDraft?: boolean;
  hasPublishScript?: boolean;
  prBodyMaxCharacters?: number;
};

type RunVersionResult = {
  pullRequestNumber: number;
};

export async function runVersion({
  script,
  githubToken,
  cwd = process.cwd(),
  prTitle = "Version Packages",
  commitMessage = "Version Packages",
  prDraft = false,
  hasPublishScript = false,
  prBodyMaxCharacters = MAX_CHARACTERS_PER_MESSAGE,
}: VersionOptions): Promise<RunVersionResult> {
  const octokit = setupOctokit(githubToken);
  const { owner, repo } = github.context.repo;

  let fullRepo = `${owner}/${repo}`;
  let branch = github.context.ref.replace("refs/heads/", "");
  let versionBranch = `changeset-release/${branch}`;

  let { preState } = await readChangesetState(cwd);

  await localGitUtils.switchToMaybeExistingBranch(versionBranch);
  // hard reset back to default branch
  // so that we can get a clean state
  // to regenerate all of the changesets
  await localGitUtils.reset(github.context.sha);
  // This query needs to execute before the force push
  // otherwise we will not be able to find the PR that
  // we are trying to update, since it'll be closed
  // by the force push
  const searchQuery = `repo:${fullRepo}+state:open+head:${versionBranch}+base:${branch}+is:pull-request`;
  const searchResult = await octokit.rest.search.issuesAndPullRequests({
    q: searchQuery,
  });
  // Because of the reset above, this push will set the
  // versionBranch to the same commit as the default branch
  // which will also close the PR if it exists.

  // We do this because we cant mutate a branch with the graphql API
  // so instead of a force push we just reset the branch and create a new commit
  // on top. Unfortunately this means that the PR will be closed and reopened
  await localGitUtils.push(versionBranch, { force: true });

  // Get the versions of each package before we 'version' them. This allows us to diff the version bumps.
  const versionsByDirectory = await getVersionsByDirectory(cwd);

  if (script) {
    let [versionCommand, ...versionArgs] = script.split(/\s+/);
    await exec(versionCommand, versionArgs, { cwd });
  } else {
    let changesetsCliPkgJson = requireChangesetsCliPkgJson(cwd);
    let cmd = semver.lt(changesetsCliPkgJson.version, "2.0.0")
      ? "bump"
      : "version";
    await exec("node", [resolveFrom(cwd, "@changesets/cli/bin.js"), cmd], {
      cwd,
    });
  }

  const changedPackages = await getChangedPackages(cwd, versionsByDirectory);
  let changedPackagesInfoPromises = Promise.all(
    changedPackages.map(async (pkg) => {
      let changelogContents = await fs.readFile(
        path.join(pkg.dir, "CHANGELOG.md"),
        "utf8",
      );

      let entry = getChangelogEntry(changelogContents, pkg.packageJson.version);
      return {
        highestLevel: entry.highestLevel,
        private: !!pkg.packageJson.private,
        content: entry.content,
        header: `## ${pkg.packageJson.name}@${pkg.packageJson.version}`,
      };
    }),
  );

  const finalPrTitle = `${prTitle}${!!preState ? ` (${preState.tag})` : ""}`;

  // project with `commit: true` setting could have already committed files
  if (!(await localGitUtils.checkIfClean())) {
    const finalCommitMessage = `${commitMessage}${
      !!preState ? ` (${preState.tag})` : ""
    }`;
    // This only works because we reset the branch above
    // since commitAll will fail otherwise, because
    // it computes the file diff from running "changesets version"
    // on the default branch, not the versionBranch

    // instead, we should probably checkout the versionBranch
    // and update it via https://docs.github.com/en/free-pro-team@latest/rest/pulls/pulls?apiVersion=2022-11-28#update-a-pull-request-branch
    // _then_ run "changesets version", then commitAll.
    await githubGitUtils.commitAll(
      octokit,
      versionBranch,
      owner,
      repo,
      finalCommitMessage,
      cwd,
    );

    // hard reset back to default branch
    // clearing all the changesets we generated
    // so we can pull the remote commit we just made
    await localGitUtils.reset(github.context.sha);
    await localGitUtils.removeUntrackedFiles();
    await localGitUtils.pullBranch(versionBranch);
  } else {
    // if commit:true then we wont be able to update the PR
    // since we only use the graphql api if we have a dirty repo
    throw Error(
      `This action only works if "commit:false" is set within .changeset/config.json`,
    );
  }

  core.info(JSON.stringify(searchResult.data, null, 2));

  const changedPackagesInfo = (await changedPackagesInfoPromises)
    .filter((x) => x)
    .sort(sortTheThings);

  let prBody = await getVersionPrBody({
    hasPublishScript,
    preState,
    fullRepo,
    branch,
    changedPackagesInfo,
    prBodyMaxCharacters,
  });

  if (searchResult.data.items.length === 0) {
    core.info("creating pull request");
    const { data: newPullRequest } = await octokit.rest.pulls.create({
      base: branch,
      head: versionBranch,
      title: finalPrTitle,
      draft: prDraft,
      body: prBody,
      ...github.context.repo,
    });

    return {
      pullRequestNumber: newPullRequest.number,
    };
  } else {
    const [pullRequest] = searchResult.data.items;
    core.info(`updating found pull request #${pullRequest.number}`);
    await octokit.rest.pulls.update({
      pull_number: pullRequest.number,
      title: finalPrTitle,
      body: prBody,
      ...(prDraft ? {} : { state: "open" }),
      ...github.context.repo,
    });

    return {
      pullRequestNumber: pullRequest.number,
    };
  }
}
