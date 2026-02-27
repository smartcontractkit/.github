import * as core from "@actions/core";
import { join, basename } from "path";
import { execa } from "execa";
import * as fs from "fs";

import { normalizeRefForFilename } from "./util";

import { CL_LOCAL_DEBUG } from "./run-inputs";
import { checkoutRef } from "./git";

// Rough type for execa result
type ExecResult = Awaited<ReturnType<typeof execa>>;

export type ExportFile = {
  path: string;
  normalizedRef: string;
  ref: string;
  resolvedRef: string;
};

export async function generateExportAtRef(
  modulePath: string,
  ref: string,
): Promise<ExportFile> {
  const normalizedRef = normalizeRefForFilename(ref);
  const outFile = `${normalizedRef}.export`;
  core.info(
    `Generating export (${outFile}) for module at ${modulePath}, at ref ${ref}.`,
  );

  const resolvedRef = await checkoutRef(modulePath, ref);
  await execa("apidiff", ["-m", "-w", outFile, "."], {
    cwd: modulePath,
  });

  return {
    path: join(modulePath, outFile),
    normalizedRef,
    ref,
    resolvedRef,
  };
}

export async function diffExports(
  baseExport: ExportFile,
  headExport: ExportFile,
) {
  core.info(
    `Comparing exports: base=${baseExport.path}, head=${headExport.path}`,
  );
  // Run apidiff comparison
  const { stdout, stderr, exitCode }: ExecResult = await execa(
    "apidiff",
    ["-m", baseExport.path, headExport.path],
    { reject: false },
  );

  if (CL_LOCAL_DEBUG) {
    await fs.promises.writeFile(
      `./apidiff-${baseExport.normalizedRef}-${headExport.normalizedRef}.txt`,
      stdout,
    );
  }

  if (stderr) {
    core.warning(`apidiff stderr: ${stderr}`);
  }
  if (exitCode !== 0 && exitCode !== 1) {
    throw new Error(`apidiff failed with exit code ${exitCode}: ${stderr}`);
  }

  return stdout;
}

/**
 * Installs apidiff via Go if not already available.
 *
 * Uses moduleDirectory as CWD to ensure Go environment is correct.
 */
export async function installApidiff(
  directory: string,
  apidiffVersion: string,
  forceInstall: boolean = false,
): Promise<void> {
  core.startGroup("Installing apidiff");
  core.info(`Requested apidiff version: ${apidiffVersion}`);
  core.info(`Force install? ${forceInstall}`);
  try {
    const isInstalled = await checkApidiffInstalled(directory);
    if (isInstalled && !forceInstall) {
      core.info("apidiff is already installed");
      return;
    }

    core.info("Installing apidiff...");
    await execa(
      "go",
      ["install", `golang.org/x/exp/cmd/apidiff@${apidiffVersion}`],
      { cwd: directory },
    );

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

async function checkApidiffInstalled(directory: string): Promise<boolean> {
  try {
    await execa("which", ["apidiff"], {
      stderr: "ignore",
      stdout: "ignore",
      cwd: directory,
    });
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
  rawOutput: string;
}

export function parseApidiffOutput(
  moduleName: string,
  output: string,
): ApiDiffResult {
  const lines = output.split(/\r?\n/);
  const result: ApiDiffResult = {
    moduleName,
    meta: [],
    incompatible: [],
    compatible: [],
    rawOutput: output,
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
