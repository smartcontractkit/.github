import { isGoModReferencingDefaultBranch } from "./github";
import { getAllGoModDeps } from "./deps";
import { FIXING_ERRORS } from "./strings";
import * as github from "@actions/github";
import * as core from "@actions/core";

function getContext() {
  const goModDir = core.getInput("go_mod_dir", { required: true });
  const githubToken = core.getInput("github_token", { required: true });

  return { goModDir, gh: github.getOctokit(githubToken) };
}

async function run() {
  const { goModDir, gh } = getContext();

  const depsToValidate = await getAllGoModDeps(goModDir);

  // <dependency-name, error-string>
  const errs: Map<string, string> = new Map();

  for (const d of depsToValidate) {
    const refsDefaultBranch = await isGoModReferencingDefaultBranch(d, gh);

    if (!refsDefaultBranch) {
      errs.set(d.name, "dependency not on default branch");
    }
  }

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

run();
