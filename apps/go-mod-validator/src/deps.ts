const { execSync } = require("child_process");

function getGoModFiles(): string[] {
  try {
    const output = execSync("find \"$(pwd)\" -type f -name 'go.mod'", {
      encoding: "utf-8",
    });
    return output.trim().split("\n");
  } catch (error) {
    if (error instanceof Error) {
      console.error(`failed to get go.mod files: ${error.message}`);
    } else {
      console.error(`failed to get go.mod files, unknown errror`);
    }
    return [];
  }
}

export function getDependenciesMap(): Map<string, any> {
  // get all go.mod files
  const modFilePaths = getGoModFiles();

  let dependenciesMap = new Map();
  modFilePaths.forEach((modFilePath: string) => {
    console.info(`finding dependencies in ${modFilePath}`);

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
      if (error instanceof Error) {
        console.error(
          `failed to get go.mod dependencies from file: ${modFilePath}  err: ${error.message}`,
        );
      } else {
        console.error(
          `failed to get go.mod dependencies from file: ${modFilePath}, unknown errror`,
        );
      }
      return dependenciesMap;
    }
  });

  return dependenciesMap;
}
