import { validateDependency } from "./github";
import { getDependenciesMap } from "./deps";
import * as core from "@actions/core";
import minimist from "minimist";
import { Octokit } from "octokit";

const smartContractKitPrefix = "github.com/smartcontractkit";

function getContext() {
  const argv = minimist(process.argv.slice(2));
  const { local, tokenEnv, goModDir } = argv;

  const dir = local ? goModDir || `"$(pwd)"` : core.getInput("go-mod-dir");

  const githubToken = local
    ? process.env[tokenEnv] || ""
    : core.getInput("github-token");

  return { goModDir: dir, octokitClient: new Octokit({ auth: githubToken }) };
}

async function run() {
  const { goModDir, octokitClient } = getContext();

  // get dependencies from go.mod file
  let dependenciesMap: Map<string, any> = new Map();
  try {
    dependenciesMap = getDependenciesMap(goModDir);
  } catch (err) {
    core.info(`failed to get dependencies, err: ${err}`);
    core.setFailed(`failed to get dependencies`);
  }

  // Verify each of the dependencies
  const validationFailedDependencies: string[] = [];
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
        if (
          !(await validateDependency(
            dependency.Path,
            dependency.Version,
            octokitClient,
          ))
        ) {
          validationFailedDependencies.push(dependencyResult);
        }
      } catch (err) {
        core.info(
          `failed to verify dependency: ${dependency.Path}@${dependency.Version}, err: ${err}`,
        );
        validationFailedDependencies.push(dependencyResult);
      }
    }
  }

  if (validationFailedDependencies.length != 0) {
    core.info(
      `validation failed for following dependencies:\n${validationFailedDependencies.join("\n")}`,
    );
    core.setFailed(
      `validation failed for ${validationFailedDependencies.length} dependencies`,
    );
  }
}

run();
