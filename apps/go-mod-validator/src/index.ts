import * as fs from "fs";
import { getSmartcontractkitDependencies } from "./parser";
import { validateDependency } from "./github";

async function run() {
  // Read required env vars
  const githubToken = process.env.GITHUB_TOKEN || "";
  if (githubToken == "") {
    console.error("no GITHUB_TOKEN env variable found");
    process.exit(1);
  }

  // read command-line arguments
  const args = process.argv.slice(2);
  if (args.length == 0) {
    console.error("need 1 argument as the input");
    process.exit(1);
  }
  const goListOutputFile = args[0];

  // Read the file content
  let goListOutputContent = "";
  try {
    goListOutputContent = fs.readFileSync(goListOutputFile, "utf-8");
  } catch (err) {
    console.error(
      `failed to read input file: ${goListOutputFile}, with err: ${err}`,
    );
    process.exit(1);
  }

  // Parse the lines, to extract smartcontractkit/ dependencies
  let dependencies = null;
  try {
    dependencies = getSmartcontractkitDependencies(goListOutputContent);
  } catch (err) {
    console.error(
      `failed to get smartcontractkit dependencies from file: ${goListOutputFile}, with err: ${err}`,
    );
    process.exit(1);
  }

  // Verify each of the dependencies
  let validationErr = null;
  for (const dependency of dependencies) {
    try {
      if (await validateDependency(dependency, githubToken)) {
        console.info(
          `${dependency.module}@${dependency.version} is found in the default branch \n`,
        );
      } else {
        console.error(
          `${dependency.module}@${dependency.version} not found in the default branch\n`,
        );
        validationErr = new Error(
          `${dependency.module}@${dependency.version} not found in the default branch`,
        );
      }
    } catch (err) {
      console.error(
        `failed to verify dependency: ${dependency.module}@${dependency.version}, with err: ${err} \n`,
      );
      validationErr = err;
    }
  }

  if (validationErr != null) {
    process.exit(1);
  }
}

run();
