import * as core from "@actions/core";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { CodeownersPattern } from "./codeowners-pattern";

function readCodeownersFile(repoDir: string): string | undefined {
  const possibleFilenames = [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
  ];

  for (const filename of possibleFilenames) {
    const fullPath = join(repoDir, filename);
    if (existsSync(fullPath)) {
      return readFileSync(fullPath, "utf8");
    }
  }

  return undefined;
}

export interface CodeownersEntry {
  pattern: CodeownersPattern;
  owners: string[];
}

export function getCodeownersRules(repoDir: string): CodeownersEntry[] {
  const fileContent = readCodeownersFile(repoDir);
  if (!fileContent) {
    return [];
  }

  const lines = fileContent.split("\n");
  const entries: CodeownersEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue; // Skip empty lines and comments
    }

    const [patternStr, ...owners] = trimmed.split(/\s+/);
    entries.push({ pattern: new CodeownersPattern(patternStr), owners });
  }

  return entries;
}

export function processChangedFiles(
  filenames: string[],
  codeownersFile: CodeownersEntry[],
) {
  const fileToOwners: Record<string, string[]> = {};
  for (const file of filenames) {
    const lastEntry = codeownersFile.findLast((entry) =>
      entry.pattern.match(file),
    );
    if (!lastEntry) {
      fileToOwners[file] = [];
      core.warning(`No CODEOWNERS entry found for: ${file}`);
      continue;
    }
    fileToOwners[file] = lastEntry.owners;
    core.debug(
      `File: ${file} matched pattern: ${lastEntry.pattern} with owners: ${lastEntry.owners.join(", ")}`,
    );
  }

  const allOwnersUnduped = Object.values(fileToOwners).flat();
  const allOwnersSet = new Set<string>(allOwnersUnduped);

  core.info(`Total unique codeowners in this PR: ${allOwnersSet.size}`);
  core.debug(
    `All unique codeowners in this PR: ${Array.from(allOwnersSet).join(", ")}`,
  );

  return { fileToOwners, allOwners: Array.from(allOwnersSet) };
}
