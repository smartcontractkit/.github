import { isGoModReferencingDefaultBranch } from "./github";
import { getDeps } from "./deps";
import { FIXING_ERRORS } from "./strings";
import * as github from "@actions/github";
import * as core from "@actions/core";

function getContext() {
  const goModDir = core.getInput("go-mod-dir", { required: true });
  const githubToken = core.getInput("github-token", { required: true });
  const depPrefix = core.getInput("dep-prefix", { required: true });

  return { goModDir, gh: github.getOctokit(githubToken), depPrefix };
}

export async function run() {
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
    await core.summary.write();

    core.setFailed(`validation failed for ${errs.size} dependencies`);
  } else {
    core.info("validation successful for all go.mod dependencies");
  }
}
