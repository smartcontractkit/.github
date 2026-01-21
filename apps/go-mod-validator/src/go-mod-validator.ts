import * as github from "@actions/github";
import * as core from "@actions/core";
import { throttling } from "@octokit/plugin-throttling";

import { getDeps, BaseGoModule, lineForDependencyPathFinder } from "./deps";
import { getChangedGoModFiles } from "./diff";
import { getDefaultBranch, isGoModReferencingBranch } from "./github";
import { getInputs } from "./run-inputs";
import { FIXING_ERRORS } from "./strings";

import type { Octokit } from "./github";
import type { GoModule } from "./deps";
import type { RunInputs } from "./run-inputs";

function getOctokits(inputs: RunInputs) {
  type ThrottlingOptions = Parameters<typeof throttling>[1];
  interface IRequestRateLimitOptions {
    method: string;
    url: string;
  }

  const options: ThrottlingOptions = {
    throttle: {
      onRateLimit: (
        retryAfter,
        options: IRequestRateLimitOptions,
        octokit,
        retryCount,
      ) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`,
        );

        if (retryCount < 1) {
          // only retries once
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (
        _,
        options: IRequestRateLimitOptions,
        octokit,
        retryCount,
      ) => {
        // does not retry, only logs a warning
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url} (retry count: ${retryCount})`,
        );
      },
    },
  };

  const octokit = github.getOctokit(
    inputs.githubToken,
    options,
    // @ts-expect-error @actions/github uses octokit/core ^5.0.1 whereas @octokit/plugin-throttling uses octokit/core ^7.0.5
    throttling,
  );

  const prReadOctokit = github.getOctokit(
    inputs.githubPrReadToken,
    options,
    // @ts-expect-error @actions/github uses octokit/core ^5.0.1 whereas @octokit/plugin-throttling uses octokit/core ^7.0.5
    throttling,
  );

  return { octokit, prReadOctokit };
}

type Invalidation = {
  type: "error" | "warning";
  msg: string;
};

export async function run(): Promise<string> {
  const inputs = getInputs();
  const { octokit, prReadOctokit } = getOctokits(inputs);
  const isPullRequest = !!github.context.payload.pull_request;

  core.debug(`Go module directory: ${inputs.goModDir}`);
  core.debug(`Dependency prefix filter: ${inputs.depPrefix || "none"}`);
  core.debug(`Pull request mode: ${isPullRequest}`);

  let depsToValidate = await getDeps(inputs.goModDir, inputs.depPrefix);
  if (isPullRequest) {
    core.info(
      "Running in pull request mode, filtering dependencies to validate based on changed files and only checking for pseudo-versions.",
    );
    const pr = github.context.payload.pull_request;
    if (!pr || !pr.number) {
      throw new Error("Expected pull request context to be present");
    }

    const { owner, repo } = github.context.repo;
    const changedFiles = await getChangedGoModFiles(
      prReadOctokit,
      pr.number,
      owner,
      repo,
      inputs.depPrefix,
    );

    core.debug(
      `Filtered changed files: ${JSON.stringify(changedFiles.map((f) => f.filename))}`,
    );
    core.debug(
      `Deps to validate: ${JSON.stringify(depsToValidate.map((d) => d.path))}`,
    );
    depsToValidate = depsToValidate.filter((d) => {
      return changedFiles.some(
        (changedFile) =>
          d.goModFilePath.includes(changedFile.filename) &&
          changedFile.addedLines.some((l) => l.content.includes(d.path)),
      );
    });

    depsToValidate = depsToValidate.filter((d) => !("tag" in d));
  } else {
    core.info(
      "Running in non-pull request mode, checking all dependencies for default branch references.",
    );
  }

  const invalidations: Map<BaseGoModule, Invalidation> = new Map();
  const validationPromises = depsToValidate.map(async (dep) => {
    const invalidation = await validateDependency(octokit, dep, inputs);
    if (invalidation) {
      invalidations.set(dep, invalidation);
    }
  });

  await Promise.all(validationPromises);

  if (invalidations.size > 0) {
    core.info(`Found ${invalidations.size} invalid dependencies.`);
    const depLineFinder = lineForDependencyPathFinder();
    const sortedErrs = [...invalidations.entries()].sort((a, b) => {
      const aKey = a[0].goModFilePath + a[0].name;
      const bKey = b[0].goModFilePath + b[0].name;

      return aKey.localeCompare(bKey);
    });
    sortedErrs.forEach(([goMod, invalidation]) => {
      // indirect dependencies are not part of the go.mod file
      // so we can't find the line number
      const line = goMod.name.endsWith("// indirect")
        ? undefined
        : depLineFinder(goMod);
      switch (invalidation.type) {
        case "error":
          core.error(invalidation.msg, {
            file: goMod.goModFilePath,
            startLine: line,
          });
          break;
        case "warning":
          core.warning(invalidation.msg, {
            file: goMod.goModFilePath,
            startLine: line,
          });
      }
    });

    core.summary.addRaw(FIXING_ERRORS, true);
    const summary = core.summary.stringify();
    await core.summary.write();

    core.setFailed(`validation failed for ${invalidations.size} dependencies`);
    return summary;
  } else {
    const msg = "validation successful for all go.mod dependencies";
    core.info(msg);
    return msg;
  }
}

async function validateDependency(
  octokit: Octokit,
  dep: GoModule,
  inputs: RunInputs,
): Promise<Invalidation | null> {
  core.info(`Validating dependency: ${dep.owner}/${dep.repo}@${dep.version}`);

  const defaultBranch = await getDefaultBranch(octokit, dep);
  const exceptions =
    inputs.repoBranchExceptions.get(`${dep.owner}/${dep.repo}`) || [];

  core.debug(`Default branch for ${dep.owner}/${dep.repo} is ${defaultBranch}`);
  core.debug(
    `Exception branches for ${dep.owner}/${dep.repo} are ${exceptions.join(", ")}`,
  );

  // Use the default branch as the first check
  let branchResult = defaultBranch;
  let result = await isGoModReferencingBranch(octokit, dep, defaultBranch);
  if (exceptions.length > 0 && !result.isInBranch) {
    // If there are branch exceptions, and the dependency version was not found in the default branch.
    for (const branch of exceptions) {
      const exceptionResult = await isGoModReferencingBranch(
        octokit,
        dep,
        branch,
      );

      // Exception branch matched, break out of the loop
      if (exceptionResult.isInBranch) {
        branchResult = branch;
        result = exceptionResult;
        break;
      }
    }
  }

  const { isInBranch, commitSha } = result;
  const detailString = formatDetailString(dep, commitSha);
  const allowedBranches = [defaultBranch, ...exceptions];

  switch (isInBranch) {
    case true:
      core.debug(`Dependency ${dep.name} found in branch ${branchResult}`);
      return null;
    case false: {
      const msg = `[${dep.goModFilePath}] dependency ${dep.name} not found in (${allowedBranches.join(", ")}).
${detailString}`;
      return { msg, type: "error" } as Invalidation;
    }
    case "unknown": {
      const msg = `[${dep.goModFilePath}] dependency ${dep.name} not found in (${allowedBranches.join(", ")}).
Reason: ${result.reason}
${detailString}`;
      return { msg, type: "warning" } as Invalidation;
    }
    default:
      {
        const assertNever = (x: never): never => {
          throw new Error(`Unhandled case: ${String(x)}`);
        };
        assertNever(isInBranch);
      }
      return null;
  }
}

function formatDetailString(dep: GoModule, commitSha: string) {
  const repoUrl = `https://github.com/${dep.owner}/${dep.repo}`;

  if ("tag" in dep) {
    return `Version(tag): ${dep.tag}
Tree: ${repoUrl}/tree/${dep.tag}
Commit: ${repoUrl}/commit/${commitSha}`;
  }

  if ("commitSha" in dep) {
    return `Version(commit): ${dep.commitSha}
Tree: ${repoUrl}/tree/${dep.commitSha}
Commit: ${repoUrl}/commit/${dep.commitSha} `;
  }

  return "";
}
