import { validateDependency } from "./github";
import { getDependenciesMap } from "./deps";

const smartContractKitPrefix = "github.com/smartcontractkit";

async function run() {
  // Read required env vars
  const githubToken = process.env.GITHUB_TOKEN || "";
  if (githubToken == "") {
    console.error("no GITHUB_TOKEN env variable found");
    process.exit(1);
  }

  // get dependencies from go.mod file
  let dependenciesMap: Map<string, any> = new Map();
  try {
    dependenciesMap = getDependenciesMap();
  } catch (err) {
    console.log(`failed to get dependencies, err: ${err}`);
    process.exit(1);
  }
  // const dependenciesMap = getDependenciesMap();

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
            githubToken,
          ))
        ) {
          validationFailedDependencies.push(dependencyResult);
        }
      } catch (err) {
        console.error(
          `failed to verify dependency: ${dependency.Path}@${dependency.Version}, err: ${err}`,
        );
        validationFailedDependencies.push(dependencyResult);
      }
    }
  }

  if (validationFailedDependencies.length != 0) {
    console.log("\nvalidation failed for following dependencies:");
    validationFailedDependencies.forEach((e) => console.log(e));
    process.exit(1);
  }
}

run();
