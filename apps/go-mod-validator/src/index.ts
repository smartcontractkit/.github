import { isGoModReferencingDefaultBranch } from "./github";
import { getAllGoModDeps } from "./deps";
import { FIXING_ERRORS } from "./strings";
import * as github from "@actions/github";
import * as core from "@actions/core";

const orgPrefix = "github.com/smartcontractkit";

function getContext() {
  const goModDir: string = core.getInput("go_mod_dir") || process.cwd();
  const githubToken: string = core.getInput("github_token") || "";

  return { goModDir, gh: github.getOctokit(githubToken) };
}

async function run() {
  const { goModDir, gh } = getContext();

  let depsToValidate: Awaited<ReturnType<typeof getAllGoModDeps>>;
  try {
    depsToValidate = await getAllGoModDeps(goModDir);
  } catch (err) {
    core.info(`failed to get dependencies, err: ${err}`);
    core.setFailed(`failed to get dependencies`);

    return;
  }

  // <dependency-name, error-string>
  const errs: Map<string, string> = new Map();

  for (let d of depsToValidate) {
    // handle replace redirectives
    if (d.Replace) {
      d = d.Replace;
    }

    // `go list -m -json all` also lists the main package, avoid parsing it.
    // and only validate dependencies belonging to our org
    if (!d.Main || !d.Path.startsWith(orgPrefix)) {
      continue;
    }

    let depName = `${d.Path}@${d.Version}`;
    if (d.Indirect) {
      depName += " // indirect";
    }

    try {
      const refsDefaultBranch = await isGoModReferencingDefaultBranch(
        {
          path: d.Path,
          version: d.Version,
        },
        gh,
      );
      if (!refsDefaultBranch) {
        errs.set(depName, "dependency not on default branch");
      }
    } catch (err: any) {
      errs.set(depName, err?.message || "unknown");
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
