import { isGoModReferencingDefaultBranch } from "./github";
import { getDeps } from "./deps";
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

  // <dependency-name, error-string>
  const errs: Map<string, string> = new Map();

  const validating = depsToValidate.map(async (d) => {
    const isValid = await isGoModReferencingDefaultBranch(d, gh);

    if (!isValid) {
      errs.set(d.name, "dependency not on default branch");
    }
  });

  await Promise.all(validating);
  if (errs.size > 0) {
    errs.forEach((depName, errMsg) =>
      core.error(`validation failed for: ${errMsg}, err: ${depName}`),
    );

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
