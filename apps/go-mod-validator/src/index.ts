import * as fs from "fs";
import { getSmartcontractkitDependencies } from "./parser";
import { validateDependency } from "./github";

async function run() {
  // Access command-line arguments
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

  // Verify each of the dependency
  let validationErr = null;
  for (const dependency of dependencies) {
    try {
      validateDependency(dependency, process.env.GITHUB_TOKEN || "");
    } catch (err) {
      console.error(
        `failed to verify dependency: ${dependency}, with err: ${err}`,
      );
      validationErr = err;
      break;
    }
  }

  if (validationErr != null) {
    process.exit(1);
  }
}

run();
