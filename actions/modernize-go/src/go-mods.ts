import * as core from "@actions/core";

import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

import * as glob from "@actions/glob";

const execAsync = promisify(exec);


/**
 * Finds all root directories of Go modules in the repository.
 * @returns Promise<string[]> - List of module directories relative to the repository root,
 * each ending with a trailing slash (except ".").
 */
export async function findGoModuleRoots(): Promise<string[]> {
  const globber = await glob.create("**/go.mod");

  const goModDirs: string[] = [];
  for await (const file of globber.globGenerator()) {
    const relDir = path.relative(process.cwd(), path.dirname(file)) || ".";
    core.debug(`Found Go module: ${relDir}`);
    goModDirs.push(relDir);
  }

  const uniqueDirs = Array.from(new Set(goModDirs)).sort();
  return uniqueDirs;
}


/**
 * Runs the Go modernize tool (`gopls/internal/analysis/modernize`) for each Go module in the repo.
 */
export async function runGoModernize(moduleRoots: string[]): Promise<void> {
  core.startGroup(`🧭 Found ${moduleRoots.length} Go module(s)`);
  for (const root of moduleRoots) {
    core.info(`- ${root}`);
  }
  core.endGroup();

  for (const modRoot of moduleRoots) {
    const cwd = modRoot === "." ? process.cwd() : path.resolve(process.cwd(), modRoot);
    const command =
      "go run golang.org/x/tools/gopls/internal/analysis/modernize/cmd/modernize@latest -fix -test ./...";

    core.startGroup(`🚀 Running modernize in ${modRoot}`);
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });

      if (stdout.trim()) core.info(stdout.trim());
      if (stderr.trim()) core.debug(stderr.trim());

      core.info(`✅ Completed modernize in ${modRoot}`);
    } catch (error: any) {
      core.error(`❌ Failed modernize in ${modRoot}: ${error.message}`);
      if (error.stdout) core.debug(error.stdout);
      if (error.stderr) core.debug(error.stderr);
    } finally {
      core.endGroup();
    }
  }
}
