import { execSync } from "child_process";
import * as core from "@actions/core";
import * as glob from "@actions/glob";

function JSONParseDependencies(jsonString: string) {
  /* example jsonString
  {
    "Path": "github.com/smartcontractkit/libocr",
    "Version": "v0.0.0-20240419185742-fd3cab206b2c"
  }
  {
    "Path": "github.com/smartcontractkit/go-proxy",
    "Version": "v0.1.0"
  }
  */

  // store parsed objects
  const objects: any[] = [];

  // keep concatenating lines until the object is complete
  let objectString = "";

  // keep track of the depth of the object
  let objectDepth = 0;

  // Process
  for (const line of jsonString.split("\n")) {
    if (line.includes("{")) {
      objectDepth++;
    }
    if (line.includes("}")) {
      objectDepth--;
    }

    objectString += line;
    if (objectDepth === 0 && objectString) {
      objects.push(JSON.parse(objectString));
      objectString = "";
    }
  }

  return objects;
}

async function getGoModFiles(goModDir: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const globber = await glob.create(`${goModDir}/**/go.mod`);
    files = await globber.glob();
  } catch (error) {
    throw new Error(`failed to get go.mod files: ${error}`);
  }

  if (files.length == 0) {
    throw new Error("no go.mod files found");
  }
  return files;
}

export async function getDependenciesMap(
  goModDir: string,
): Promise<Map<string, any>> {
  const modFilePaths = await getGoModFiles(goModDir);

  const dependenciesMap = new Map();
  modFilePaths.forEach((modFilePath: string) => {
    core.info(`finding dependencies in ${modFilePath}`);

    // modFilePath format /path/to/repo/go.mod
    const modFileDir = modFilePath.slice(0, -6);

    // get it's dependencies in json format
    try {
      const output = execSync(`cd ${modFileDir}; go list -json -m all`, {
        encoding: "utf-8",
      });
      dependenciesMap.set(modFilePath, JSONParseDependencies(output));
    } catch (error) {
      throw new Error(
        `failed to get go.mod dependencies from file: ${modFilePath}: ${error}`,
      );
    }
  });

  return dependenciesMap;
}
