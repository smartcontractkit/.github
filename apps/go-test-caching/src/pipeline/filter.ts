import * as path from "path";

import * as core from "@actions/core";
import { execa } from "execa";

import { LocalPackages } from "./index.js";

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

/**
 * Finds all packages with a //go:build <tag> directive. First finds all files
 * *_test.go files, and greps for the directive. Takes the directories of each file found,
 * lists the packages for each directory, and returns the unique list of packages.
 * @param tag The build tag to search for
 * @returns A list of packages with the build tag in a *_test.go file
 */
export async function findTaggedTestPackages(
  moduleDirectory: string,
  tag: string,
) {
  core.debug(`Finding packages with build tag ${tag}`);

  const cmd = "find";
  const flags = [
    `.`,
    "-name",
    "*_test.go",
    "-exec",
    "grep",
    "-l",
    `//go:build ${tag}`,
    "{}",
    "+",
  ];
  core.info(`Exec: ${cmd} ${flags.join(" ")}`);

  const { stdout } = await execa(cmd, flags, {
    stdout: "pipe",
    lines: true,
    cwd: moduleDirectory,
  });

  if (stdout.length === 0) {
    core.debug(`No packages found with build tag ${tag}`);
    return {};
  }

  const directories = stdout
    .filter((pkg) => pkg.trim() !== "")
    .map((file) => {
      return path.dirname(file);
    });

  const packagePromises = directories.map((dir) => listPackages(dir));
  const packages = await Promise.all(packagePromises);
  return flatten(packages);
}
function flatten(packages: LocalPackages[]) {
  return packages.reduce((acc, obj) => ({ ...acc, ...obj }), {});
}
