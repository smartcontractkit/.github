import { validateDependency } from "./github";
import { getDependenciesMap } from "./deps";
import * as core from "@actions/core";
import minimist from "minimist";
import { Octokit } from "octokit";

const smartContractKitPrefix = "github.com/smartcontractkit";

function getOctokitClient() {
  const argv = minimist(process.argv.slice(2));
  const { local, tokenEnv } = argv;
  const githubToken = local
    ? process.env[tokenEnv] || ""
    : core.getInput("github-token");

  return new Octokit({ auth: githubToken });
}

async function run() {
  const octokitClient = getOctokitClient();

  // get dependencies from go.mod file
  let dependenciesMap: Map<string, any> = new Map();
  try {
    dependenciesMap = getDependenciesMap();
  } catch (err) {
    core.setFailed(`failed to get dependencies, err: ${err}`);
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
        core.error(
          `failed to verify dependency: ${dependency.Path}@${dependency.Version}, err: ${err}`,
        );
        validationFailedDependencies.push(dependencyResult);
      }
    }
  }

  if (validationFailedDependencies.length != 0) {
    core.setFailed("validation failed for following dependencies:");
    validationFailedDependencies.forEach((e) => core.error(e));
  }
}

run();
