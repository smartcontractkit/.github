import { createReadStream } from "fs";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";

import * as core from "@actions/core";

import { getHashFile } from "../github.js";
import { HashedCompiledPackages } from "./index.js";

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const input = createReadStream(filePath);
  await pipeline(input, hash);
  return hash.digest("hex");
}

export function comparePackagesToIndex(
  packages: HashedCompiledPackages,
  hashIndex: Awaited<ReturnType<typeof getHashFile>>,
): HashedCompiledPackages {
  const filteredCompiledTestPackages: HashedCompiledPackages = {};
  for (const [importPath, pkg] of Object.entries(packages)) {
    const existingHash = hashIndex[importPath];

    if (!existingHash) {
      core.debug(`Found new test package ${importPath}`);
      filteredCompiledTestPackages[importPath] = pkg;
    } else if (existingHash !== pkg.hash) {
      core.debug(
        `Found change in ${importPath} (${existingHash} -> ${pkg.hash})`,
      );
      filteredCompiledTestPackages[importPath] = pkg;
    } else {
      core.debug(`Skipping ${importPath} - no changes`);
    }
  }

  if (core.isDebug()) {
    for (const [importPath, hash] of Object.entries(hashIndex)) {
      if (!packages[importPath]) {
        core.debug(`Found deleted test package ${importPath}`);
      }
    }
  }

  return filteredCompiledTestPackages;
}
