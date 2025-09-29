import * as github from "@actions/github";
import * as core from "@actions/core";
import { throttling } from "@octokit/plugin-throttling";

import { getDeps, BaseGoModule, lineForDependencyPathFinder } from "./deps";
import { getChangedGoModFiles } from "./diff";
import { getDefaultBranch, isGoModReferencingDefaultBranch } from "./github";
import { getInputs } from "./run-inputs";
import { FIXING_ERRORS } from "./strings";

function getContext() {
  const { goModDir, githubToken, depPrefix } = getInputs();

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
    githubToken,
    options,
    // @ts-ignore
    throttling,
  );

  const isPullRequest = !!github.context.payload.pull_request;

  return { goModDir, octokit, depPrefix, isPullRequest };
}

export async function run(): Promise<string> {
  const { goModDir, octokit, depPrefix, isPullRequest } = getContext();

  let depsToValidate = await getDeps(goModDir, depPrefix);
  if (isPullRequest) {
    core.info(
      "Running in pull request mode, filtering dependencies to validate based on changed files and only checking for pseudo-versions.",
    );
    const pr = github.context.payload.pull_request;
    if (!pr) {
      throw new Error("Expected pull request context to be present");
    }
    const base: string = pr.base.sha;
    const head: string = pr.head.sha;
    const { owner, repo } = github.context.repo;

    const changedFiles = await getChangedGoModFiles(
      octokit,
      base,
      head,
      owner,
      repo,
      depPrefix,
    );

    core.debug(
      `Changed files: ${JSON.stringify(changedFiles.map((f) => f.filename))}`,
    );
    core.debug(
      `Deps to validate: ${JSON.stringify(depsToValidate.map((d) => d.path))}`,
    );
    depsToValidate = depsToValidate.filter((d) => {
      return changedFiles.some(
        (f) =>
          d.goModFilePath.includes(f.filename) &&
          f.addedLines.some((l) => l.content.includes(d.path)),
      );
    });

    depsToValidate = depsToValidate.filter((d) => !("tag" in d));
  } else {
    core.info(
      "Running in non-pull request mode, checking all dependencies for default branch references.",
    );
  }

  const invalidations: Map<
    BaseGoModule,
    {
      type: "error" | "warning";
      msg: string;
    }
  > = new Map();
  const validating = depsToValidate.map(async (d) => {
    // Bit of a code smell, but I wanted to avoid adding the defaultBranchGetter to deps.ts to keep it separate from
    // the GitHub API client.
    // And we want the default branch available in this scope for context.
    const defaultBranch = await getDefaultBranch(octokit, d);
    const result = await isGoModReferencingDefaultBranch(
      octokit,
      d,
      defaultBranch,
    );
    const { commitSha, isInDefault } = result;

    const repoUrl = `https://github.com/${d.owner}/${d.repo}`;
    let detailString = "";
    if ("tag" in d) {
      detailString = `Version(tag): ${d.tag}
Tree: ${repoUrl}/tree/${d.tag}
Commit: ${repoUrl}/commit/${commitSha}`;
    }
    if ("commitSha" in d) {
      detailString = `Version(commit): ${d.commitSha}
Tree: ${repoUrl}/tree/${d.commitSha}
Commit: ${repoUrl}/commit/${d.commitSha} `;
    }

    switch (isInDefault) {
      case true:
        break;
      case false: {
        const msg = `[${d.goModFilePath}] dependency ${d.name} not on default branch (${defaultBranch}).
${detailString}`;

        invalidations.set(d, { msg, type: "error" });
        break;
      }
      case "unknown": {
        const msg = `[${d.goModFilePath}] dependency ${d.name} not found in default branch (${defaultBranch}).
Reason: ${result.reason}
${detailString}`;

        invalidations.set(d, { msg, type: "warning" });
        break;
      }
      default:
        {
          // exhaustive check
          const isNever = (isInDefault: never) => isInDefault;
          isNever(isInDefault);
        }
        break;
    }
  });

  await Promise.all(validating);

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
