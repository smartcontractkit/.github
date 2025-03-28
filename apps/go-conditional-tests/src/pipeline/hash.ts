import { createReadStream } from "fs";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";

import { getTestHashIndex } from "../github.js";
import {
  HashedCompiledPackages,
  DiffedHashedCompiledPackages,
} from "../pipeline.js";
import { insertWithoutDuplicates } from "../utils.js";

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const input = createReadStream(filePath);
  await pipeline(input, hash);
  return hash.digest("hex");
}

export function comparePackagesToIndex(
  runAllTests: boolean,
  packages: HashedCompiledPackages,
  hashIndex: Awaited<ReturnType<typeof getTestHashIndex>>,
): DiffedHashedCompiledPackages {
  const diffedHashedCompiledPkgs: DiffedHashedCompiledPackages = {};
  for (const [importPath, pkg] of Object.entries(packages)) {
    const existingHash = hashIndex[importPath];
    const shouldRun = runAllTests || !existingHash || existingHash !== pkg.hash;

    const value = {
      ...pkg,
      indexHash: existingHash,
      shouldRun,
    };

    insertWithoutDuplicates(importPath, value, diffedHashedCompiledPkgs);
  }

  return diffedHashedCompiledPkgs;
}
