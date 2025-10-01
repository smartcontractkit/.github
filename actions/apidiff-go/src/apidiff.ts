import * as core from "@actions/core";
import { join, basename } from "path";
import { execa } from "execa";
import * as fs from "fs";
import { CL_LOCAL_DEBUG } from "./run-inputs";

// Rough type for execa result
type ExecResult = Awaited<ReturnType<typeof execa>>;
export async function runApidiff(
  baseDir: string,
  headDir: string,
  goModPaths: string[],
) {
  core.startGroup("Running apidiff");
  core.info(`Running apidiff between base and head directories`);
  core.info(`Base directory: ${baseDir}`);
  core.info(`Head directory: ${headDir}`);
  core.info(`Go module paths: ${goModPaths.join(", ")}`);

  const results: Record<string, string> = {};
  for (const goModPath of goModPaths) {
    // Get module name from go.mod for naming exports
    const fullModulePathBase = join(baseDir, goModPath);
    const fullModulePathHead = join(headDir, goModPath);
    if (!fs.existsSync(fullModulePathBase)) {
      core.warning(`Module not found: ${fullModulePathBase}`);
      continue;
    } else if (!fs.existsSync(fullModulePathHead)) {
      core.warning(`Module not found: ${fullModulePathHead}`);
      continue;
    }
    const moduleName = await getModuleName(fullModulePathBase);

    const baseExportFile = join(process.cwd(), `${moduleName}-base.export`);
    const headExportFile = join(process.cwd(), `${moduleName}-head.export`);

    try {
      await Promise.all([
        generateExport(fullModulePathBase, baseExportFile),
        generateExport(fullModulePathHead, headExportFile),
      ]);

      core.info(`Comparing exports for module ${moduleName}`);
      core.info(`Base export file: ${baseExportFile}`);
      core.info(`Head export file: ${headExportFile}`);

      // Run apidiff comparison
      const { stdout, stderr, exitCode }: ExecResult = await execa(
        "apidiff",
        ["-m", baseExportFile, headExportFile],
        { reject: false },
      );

      if (CL_LOCAL_DEBUG) {
        // write output to file
        await fs.promises.writeFile(`./apidiff-output.txt`, stdout);
      }

      if (stderr) {
        core.warning(`apidiff stderr: ${stderr}`);
      }
      if (exitCode !== 0 && exitCode !== 1) {
        throw new Error(`apidiff failed with exit code ${exitCode}: ${stderr}`);
      }
      results[moduleName] = stdout;
    } catch (error) {
      core.setFailed(
        `Failed to generate exports for module ${moduleName}: ${error}`,
      );
      continue;
    } finally {
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

      core.endGroup();
    }
  }

  return results;
}

async function generateExport(modulePath: string, outFile: string) {
  core.info(
    `Generating export for module at ${modulePath}. Writing to ${outFile}`,
  );
  await execa("apidiff", ["-m", "-w", outFile, "."], {
    cwd: modulePath,
  });
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
export async function installApidiff(
  apidiffVersion: string,
  forceInstall: boolean = false,
): Promise<void> {
  core.startGroup("Installing apidiff");
  core.info(`Requested apidiff version: ${apidiffVersion}`);
  core.info(`Force install? ${forceInstall}`);
  try {
    const isInstalled = await checkApidiffInstalled();
    if (isInstalled && !forceInstall) {
      core.info("apidiff is already installed");
      return;
    }

    core.info("Installing apidiff...");
    await execa("go", [
      "install",
      `golang.org/x/exp/cmd/apidiff@${apidiffVersion}`,
    ]);

    const goPath = process.env.GOPATH || join(process.env.HOME || "", "go");
    const goBin = join(goPath, "bin");
    core.addPath(goBin);
    core.info("apidiff installed successfully");
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    throw new Error(`Failed to install apidiff: ${message}`);
  } finally {
    core.endGroup();
  }
}

async function checkApidiffInstalled(): Promise<boolean> {
  try {
    await execa("which", ["apidiff"], { stderr: "ignore", stdout: "ignore" });
    core.warning(
      "apidiff is already installed and may not be the correct version",
    );
    return true;
  } catch {
    return false;
  }
}

interface MetaDiff {
  header: string;
  first: string;
  second: string;
}
export interface Change {
  element: string;
  change: string;
}
export interface ApiDiffResult {
  moduleName: string;
  meta: MetaDiff[];
  incompatible: Change[];
  compatible: Change[];
}

export function parseApidiffOutputs(
  output: Record<string, string>,
): ApiDiffResult[] {
  const out: ApiDiffResult[] = [];
  for (const [moduleName, moduleOutput] of Object.entries(output)) {
    out.push(parseApidiffOutput(moduleName, moduleOutput));
  }
  return out;
}

function parseApidiffOutput(moduleName: string, output: string): ApiDiffResult {
  const lines = output.split(/\r?\n/);
  const result: ApiDiffResult = {
    moduleName,
    meta: [],
    incompatible: [],
    compatible: [],
  };
  let section: "meta" | "incompatible" | "compatible" | null = null;
  let currentMeta: MetaDiff | null = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith("! ")) {
      if (currentMeta) result.meta.push(currentMeta);
      currentMeta = { header: line.slice(2), first: "", second: "" };
      section = "meta";
      continue;
    }
    if (section === "meta" && currentMeta) {
      if (line.startsWith("first:")) {
        currentMeta.first = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("second:")) {
        currentMeta.second = line.slice(7).trim();
        continue;
      }
    }
    if (line === "Incompatible changes:") {
      if (currentMeta) result.meta.push(currentMeta);
      currentMeta = null;
      section = "incompatible";
      continue;
    }
    if (line === "Compatible changes:") {
      section = "compatible";
      continue;
    }

    if (
      (section === "incompatible" || section === "compatible") &&
      line.startsWith("- ")
    ) {
      const content = line.slice(2);
      const sepIdx = content.indexOf(": ");
      if (sepIdx >= 0) {
        const element = content.slice(0, sepIdx);
        const change = content.slice(sepIdx + 2);
        (section === "incompatible"
          ? result.incompatible
          : result.compatible
        ).push({ element, change });
      }
    }
  }
  if (currentMeta) result.meta.push(currentMeta);
  return result;
}
