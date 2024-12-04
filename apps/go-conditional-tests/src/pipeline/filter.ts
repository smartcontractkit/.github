import * as path from "path";

import * as core from "@actions/core";
import { execa } from "execa";

import { LocalPackages } from "../pipeline.js";

/**
 * Lists all packages in the given path. Defaults to the current directory (./).
 * @param path The path to list packages for
 * @returns A list of packages in the given path
 */
export async function listPackages(moduleDirectory: string) {
  const cmd = "go";
  const flags = ["list", "-f", "{{.ImportPath}}:{{.Dir}}", `./...`];
  core.info(`Exec: ${cmd} ${flags.join(" ")}`);
  core.debug(`Listing packages in ${moduleDirectory}`);

  const { stdout } = await execa(cmd, flags, {
    stdout: "pipe",
    lines: true,
    cwd: moduleDirectory,
  });

  return stdout
    .filter((line) => line.trim() !== "")
    .reduce((acc, line) => {
      const [importPath, directory] = line.split(":");

      if (acc[importPath]) {
        core.info(`Duplicate package found`);
        core.debug(
          `Existing: ${acc[importPath].importPath} - ${acc[importPath].directory}`,
        );
        core.debug(`Duplicate: ${importPath} - ${directory}`);
        return acc;
      }

      return {
        ...acc,
        [importPath]: {
          importPath,
          directory,
        },
      };
    }, {} as LocalPackages);
}
