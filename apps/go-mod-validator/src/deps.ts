import { execSync } from "child_process";
import * as core from "@actions/core";

function getGoModFiles(): string[] {
  try {
    const output = execSync("find \"$(pwd)\" -type f -name 'go.mod'", {
      encoding: "utf-8",
    });
    return output.trim().split("\n");
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  }
}

export function getDependenciesMap(): Map<string, any> {
  // get all go.mod files
  const modFilePaths = getGoModFiles();

  const dependenciesMap = new Map();
  modFilePaths.forEach((modFilePath: string) => {
    core.info(`finding dependencies in ${modFilePath}`);

    // get the dir of go.mod file
    const modFileDir = modFilePath.slice(0, -6);

    // get it's dependencies in json format
    try {
      const output = execSync(
        `cd ${modFileDir}; go list -json -m all | jq -c -s .`,
        { encoding: "utf-8" },
      );
      dependenciesMap.set(modFilePath, JSON.parse(output));
    } catch (error) {
      throw new Error(
        `failed to get go.mod dependencies from file: ${modFilePath}: ${error}`,
      );
    }
  });

  return dependenciesMap;
}
