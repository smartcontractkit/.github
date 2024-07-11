import { execSync } from "child_process";
import * as core from "@actions/core";

function getGoModFiles(goModDir: string): string[] {
  let output = execSync(`ls ${goModDir}`, { encoding: "utf-8" });
  core.info(`ls: ${output}`);

  try {
    output = execSync(`find ${goModDir} -type f -name 'go.mod'`, {
      encoding: "utf-8",
    });
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  }

  if (output.length == 0) {
    throw new Error("no go.mod files found");
  }
  return output.trim().split("\n");
}

export function getDependenciesMap(goModDir: string): Map<string, any> {
  // get all go.mod files
  const modFilePaths = getGoModFiles(goModDir);

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
