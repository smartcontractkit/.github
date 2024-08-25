import { getDefaultBranch, isGoModReferencingDefaultBranch } from "./github";
import { getDeps, BaseGoModule, lineForDependencyPathFinder } from "./deps";
import { FIXING_ERRORS } from "./strings";
import * as github from "@actions/github";
import * as core from "@actions/core";
import { throttling } from "@octokit/plugin-throttling";

function getContext() {
  const goModDir = core.getInput("go-mod-dir", { required: true });
  const githubToken = core.getInput("github-token", { required: true });
  const depPrefix = core.getInput("dep-prefix", { required: true });
  const gh = github.getOctokit(
    githubToken,
    {
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          octokit.log.warn(
            `Request quota exhausted for request ${options.method} ${options.url}`,
          );

          if (retryCount < 1) {
            // only retries once
            octokit.log.info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          // does not retry, only logs a warning
          octokit.log.warn(
            `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
          );
        },
      },
    },
    throttling,
  );

  return { goModDir, gh, depPrefix };
}

export async function run(): Promise<string> {
  const { goModDir, gh, depPrefix } = getContext();

  const depsToValidate = await getDeps(goModDir, depPrefix);

  const errs: Map<BaseGoModule, string> = new Map();
  const validating = depsToValidate.map(async (d) => {
    // Bit of a code smell, but I wanted to avoid adding the defaultBranchGetter to deps.ts to keep it separate from
    // the GitHub API client.
    // And we want the default branch available in this scope for context.
    const defaultBranch = await getDefaultBranch(gh, d);
    const isValid = await isGoModReferencingDefaultBranch(d, defaultBranch, gh);

    let parsedVersion = "UNKNOWN";
    if ("commitSha" in d) {
      parsedVersion = d.commitSha;
    }
    if ("tag" in d) {
      parsedVersion = d.tag;
    }

    if (!isValid) {
      errs.set(
        d,
        `[${d.goModFilePath}] dependency ${d.name} not on default branch.
Default branch: ${defaultBranch}
Version: ${parsedVersion}`,
      );
    }
  });

  await Promise.all(validating);

  if (errs.size > 0) {
    const depLineFinder = lineForDependencyPathFinder();
    const sortedErrs = [...errs.entries()].sort((a, b) => {
      const aKey = a[0].goModFilePath + a[0].name;
      const bKey = b[0].goModFilePath + b[0].name;

      return aKey.localeCompare(bKey);
    });
    sortedErrs.forEach(([goMod, validationErr]) => {
      const line = depLineFinder(goMod.goModFilePath, goMod.path);
      core.error(`err: ${validationErr}`, {
        file: goMod.goModFilePath,
        startLine: line,
      });
    });

    core.summary.addRaw(FIXING_ERRORS, true);
    const summary = core.summary.stringify();
    await core.summary.write();

    core.setFailed(`validation failed for ${errs.size} dependencies`);
    return summary;
  } else {
    const msg = "validation successful for all go.mod dependencies";
    core.info(msg);
    return msg;
  }
}
