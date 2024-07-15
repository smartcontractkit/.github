import { validateDependency } from "./github";
import { getDependenciesMap } from "./deps";
import { FIXING_ERRORS } from "./strings";
import * as github from "@actions/github";
import * as core from "@actions/core";
import minimist from "minimist";

const smartContractKitPrefix = "github.com/smartcontractkit";

function getContext() {
  const argv = minimist(process.argv.slice(2));
  const { local, tokenEnv, goModDir } = argv;

  const dir = local ? goModDir || process.cwd() : core.getInput("go-mod-dir");

  const githubToken = local
    ? process.env[tokenEnv] || ""
    : core.getInput("github-token");

  return { goModDir: dir, octokitClient: github.getOctokit(githubToken) };
}

async function run() {
  const { goModDir, octokitClient } = getContext();

  // get dependencies from go.mod file
  let dependenciesMap: Map<string, any> = new Map();
  try {
    dependenciesMap = await getDependenciesMap(goModDir);
  } catch (err) {
    core.info(`failed to get dependencies, err: ${err}`);
    core.setFailed(`failed to get dependencies`);
  }

  // <failed-dependency, error-string>
  const validationFailedDependencies: Map<string, string> = new Map();

  // Verify each of the dependencies
  for (const [file, dependencies] of dependenciesMap.entries()) {
    for (let dependency of dependencies) {
      // handle replace redirectives
      if (dependency.Replace != undefined) {
        dependency = dependency.Replace;
      }

      // `go list -m -json all` also lists the main pacakge, avoid parsing it.
      // and only validate dependencies belonging to our org
      if (
        dependency.Version == undefined ||
        !dependency.Path.startsWith(smartContractKitPrefix)
      ) {
        continue;
      }

      // prepare dependency result string
      let dependencyResult = `${dependency.Path}@${dependency.Version}`;
      if (dependency.Indirect == true) {
        dependencyResult += " // indirect";
      }

      // validate the dependency
      try {
        const validationResult = await validateDependency(
          dependency.Path,
          dependency.Version,
          octokitClient,
        );
        if (!validationResult) {
          validationFailedDependencies.set(
            dependencyResult,
            "dependency not on default branch",
          );
        }
      } catch (err: any) {
        validationFailedDependencies.set(
          dependencyResult,
          err?.message || "unknown",
        );
      }
    }
  }

  if (validationFailedDependencies.size > 0) {
    validationFailedDependencies.forEach((val, key) =>
      core.info(`validation failed for: ${key}, err: ${val}`),
    );

    core.summary.addRaw(FIXING_ERRORS, true);
    await core.summary.write();

    core.setFailed(
      `validation failed for ${validationFailedDependencies.size} dependencies`,
    );
  } else {
    core.info("validation successful for all go.mod dependencies");
  }
}

run();
