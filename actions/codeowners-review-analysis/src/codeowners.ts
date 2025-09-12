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
  rawLine: string;
  rawPattern: string;
  rawOwners: string;
  pattern: CodeownersPattern;
  lineNumber: number; // For error reporting, if desired
  owners: string[];
}

export function getCodeownersRules(repoDir: string): CodeownersEntry[] {
  const fileContent = readCodeownersFile(repoDir);
  if (!fileContent) {
    return [];
  }

  const lines = fileContent.split("\n");
  const entries: CodeownersEntry[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue; // Skip empty lines and comments
    }

    const [patternStr, ...owners] = trimmed.split(/\s+/);
    const codeownersPattern = new CodeownersPattern(patternStr);
    entries.push({
      rawLine: line,
      rawPattern: patternStr,
      rawOwners: owners.join(" "),
      pattern: codeownersPattern,
      owners,
      lineNumber: index + 1,
    });
  }

  return entries;
}

export function processChangedFiles(
  filenames: string[],
  codeownersFile: CodeownersEntry[],
) {
  const fileToOwners: Record<string, string[]> = {};
  const relevantCodeownersEntries = new Set<CodeownersEntry>();
  const codeOwnersEntryToFiles: Map<CodeownersEntry, string[]> = new Map();
  const unownedFiles: string[] = [];
  for (const file of filenames) {
    // Use last entry because later entries override earlier ones
    const lastEntry = codeownersFile.findLast((entry) =>
      entry.pattern.match(file),
    );
    if (!lastEntry) {
      fileToOwners[file] = [];
      unownedFiles.push(file);
      core.warning(`No CODEOWNERS entry found for: ${file}`);
      continue;
    }
    addToMapOfArrays(codeOwnersEntryToFiles, lastEntry, file);
    relevantCodeownersEntries.add(lastEntry);
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

  return {
    fileToOwners,
    allOwners: Array.from(allOwnersSet),
    relevantCodeownersEntries: Array.from(relevantCodeownersEntries),
    unownedFiles,
    codeOwnersEntryToFiles,
  };
}

export type CodeOwnersToFilesMap = Map<CodeownersEntry, string[]>;

export function processChangedFilesV2(
  filenames: string[],
  codeownersFile: CodeownersEntry[],
) {
  const codeOwnersEntryToFiles: Map<CodeownersEntry, string[]> = new Map();
  const unownedFiles: string[] = [];
  for (const file of filenames) {
    // Use last entry because later entries override earlier ones
    const lastEntry = codeownersFile.findLast((entry) =>
      entry.pattern.match(file),
    );
    if (!lastEntry) {
      unownedFiles.push(file);
      core.warning(`No CODEOWNERS entry found for: ${file}`);
      continue;
    }
    addToMapOfArrays(codeOwnersEntryToFiles, lastEntry, file);
    core.debug(
      `File: ${file} matched pattern: ${lastEntry.pattern} with owners: ${lastEntry.owners.join(", ")}`,
    );
  }

  return { unownedFiles, codeOwnersEntryToFiles };
}

function addToMapOfArrays<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key)!.push(value);
}
