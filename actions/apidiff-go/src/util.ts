import * as core from "@actions/core";
import * as semver from "semver";
import { basename, join } from "path";
import { readFileSync, existsSync, copyFileSync } from "fs";

/**
 * Extracts the module name from go.mod file
 */
export async function getGoModuleName(moduleDir: string): Promise<string> {
  try {
    const goModPath = join(moduleDir, "go.mod");

    if (!existsSync(goModPath)) {
      core.warning(`go.mod not found at ${goModPath}, using directory name`);
      return basename(moduleDir);
    }

    const goModContent = readFileSync(goModPath, "utf8");
    const moduleMatch = goModContent.match(/^module\s+(.+)$/m);

    if (moduleMatch && moduleMatch[1]) {
      return moduleMatch[1].trim();
    }

    core.warning(
      `Could not parse module name from ${goModPath}, using directory name`,
    );
    return basename(moduleDir);
  } catch (error) {
    core.warning(`Error reading go.mod: ${error}, using directory name`);
    return basename(moduleDir);
  }
}

/**
 * Normalize a Git ref so it can be safely used as part of a filename.
 * Example: "feature/new-ui" -> "feature_new-ui"
 * Result will contain only: letters, numbers, `_`, `-`, `.`
 */
export function normalizeRefForFilename(ref: string): string {
  if (ref == null || ref.trim() === "") {
    throw new Error("Cannot normalize empty or null ref");
  }

  let safe = ref.trim();
  // Replace path separators & spaces with underscores
  safe = safe.replace(/[\/\s]+/g, "_");
  // Remove unsafe filename characters
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, "");
  // Collapse multiple underscores
  safe = safe.replace(/_+/g, "_");
  // Prevent filenames like ".hidden"
  safe = safe.replace(/^\.+/, "");

  if (safe === "") {
    throw new Error(`Ref '${ref}' could not be normalized to a safe filename`);
  }

  return safe;
}

export function copySummaryOutputFile(destination: string) {
  const filePath = process.env["GITHUB_STEP_SUMMARY"];
  if (!filePath) {
    core.warning(
      "GITHUB_STEP_SUMMARY environment variable is not set. Cannot copy summary output.",
    );
    return;
  }

  try {
    core.info(`Copying summary output from ${filePath} to ${destination}`);
    copyFileSync(filePath, destination);
  } catch (error) {
    core.warning(`Failed to copy summary output: ${error}`);
  }
}

export function recommendVersionBump(diff: {
  incompatible: any[];
  compatible: any[];
}): "patch" | "minor" | "major" {
  // Simple heuristic based on gorelease: https://pkg.go.dev/golang.org/x/exp/cmd/gorelease
  if (diff.incompatible.length > 0) {
    return "major";
  } else if (diff.compatible.length > 0) {
    return "minor";
  } else {
    return "patch";
  }
}
