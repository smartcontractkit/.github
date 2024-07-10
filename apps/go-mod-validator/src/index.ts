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
  const dependenciesMap = getDependenciesMap();

  // Verify each of the dependencies
  let validationErr = null;
  for (let [file, dependencies] of dependenciesMap.entries()) {
    console.info(`\nvalidating dependencies for ${file}`);

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

      try {
        if (
          await validateDependency(
            dependency.Path,
            dependency.Version,
            githubToken,
          )
        ) {
          console.info(
            `${dependency.Path}@${dependency.Version} is found in the default branch`,
          );
        } else {
          console.error(
            `${dependency.Path}@${dependency.Version} not found in the default branch`,
          );
          validationErr = new Error(
            `${dependency.Path}@${dependency.Version} not found in the default branch`,
          );
        }
      } catch (err) {
        console.error(
          `failed to verify dependency: ${dependency.Path}@${dependency.Version}, with err: ${err}`,
        );
        validationErr = err;
      }
    }
  }

  if (validationErr != null) {
    process.exit(1);
  }
}

run();
