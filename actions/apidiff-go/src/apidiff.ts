import * as core from "@actions/core";
import { join, basename, dirname } from "path";
import { execa } from "execa";
import * as fs from "fs";

// Rough type for execa result
type ExecResult = Awaited<ReturnType<typeof execa>>;
export async function runApidiff(
  baseDir: string,
  headDir: string,
  goModPath: string = ".",
) {
  core.info(`Running apidiff between base and head directories`);
  core.info(`Base directory: ${baseDir}`);
  core.info(`Head directory: ${headDir}`);
  core.info(`Go module path: ${goModPath}`);

  // Get module name from go.mod for naming exports
  const moduleName = await getModuleName(join(baseDir, goModPath));

  // Create export paths using absolute paths
  const baseExportFile = join(process.cwd(), `${moduleName}-base.export`);
  const headExportFile = join(process.cwd(), `${moduleName}-head.export`);
  try {
    core.info(`Creating exports: ${baseExportFile}, ${headExportFile}`);
    // Create exports for base and head versions
    await execa("apidiff", ["-m", "-w", baseExportFile, "."], {
      cwd: join(baseDir, goModPath),
    });

    await execa("apidiff", ["-m", "-w", headExportFile, "."], {
      cwd: join(headDir, goModPath),
    });

    // Run apidiff comparison
    const { stdout, stderr, exitCode }: ExecResult = await execa(
      "apidiff",
      ["-m", baseExportFile, headExportFile],
      { reject: false },
    );

    if (stderr) {
      core.warning(`apidiff stderr: ${stderr}`);
    }
    if (exitCode !== 0 && exitCode !== 1) {
      throw new Error(`apidiff failed with exit code ${exitCode}: ${stderr}`);
    }

    return stdout;
  } finally {
    // Clean up export files
    try {
      if (fs.existsSync(baseExportFile)) {
        fs.unlinkSync(baseExportFile);
      }
      if (fs.existsSync(headExportFile)) {
        fs.unlinkSync(headExportFile);
      }
    } catch (error) {
      core.warning(`Failed to clean up export files: ${error}`);
    }
  }
}

/**
 * Extracts the module name from go.mod file
 */
async function getModuleName(goModDir: string): Promise<string> {
  try {
    const goModPath = join(goModDir, "go.mod");

    if (!fs.existsSync(goModPath)) {
      core.warning(`go.mod not found at ${goModPath}, using directory name`);
      return basename(goModDir);
    }

    const goModContent = fs.readFileSync(goModPath, "utf8");
    const moduleMatch = goModContent.match(/^module\s+(.+)$/m);

    if (moduleMatch && moduleMatch[1]) {
      const moduleName = moduleMatch[1].trim();
      // Sanitize module name for filesystem use
      return moduleName.replace(/[^a-zA-Z0-9\-_]/g, "-");
    }

    core.warning(
      `Could not parse module name from ${goModPath}, using directory name`,
    );
    return basename(goModDir);
  } catch (error) {
    core.warning(`Error reading go.mod: ${error}, using directory name`);
    return basename(goModDir);
  }
}

/**
 * Installs apidiff via Go if not already available
 */
export async function installApidiff(): Promise<void> {
  const isInstalled = await checkApidiffInstalled();
  if (isInstalled) {
    core.info("apidiff is already installed");
    return;
  }

  core.info("Installing apidiff...");
  await execa("go", ["install", "golang.org/x/exp/cmd/apidiff@latest"], {
    reject: false,
  });

  const goPath = process.env.GOPATH || join(process.env.HOME || "", "go");
  const goBin = join(goPath, "bin");
  core.addPath(goBin);

  core.info("apidiff installed successfully");
}

async function checkApidiffInstalled(): Promise<boolean> {
  try {
    await execa("which", ["apidiff"], { stderr: "ignore", stdout: "ignore" });
    return true;
  } catch {
    return false;
  }
}
