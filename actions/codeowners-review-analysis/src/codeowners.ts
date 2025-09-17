import * as core from "@actions/core";

import { CodeownersPattern } from "./codeowners-pattern";

export interface CodeownersEntry {
  rawLine: string;
  rawPattern: string;
  rawOwners: string;
  pattern: CodeownersPattern;
  lineNumber: number; // For error reporting, if desired
  htmlLineUrl?: string; // Optional link to the line in the CODEOWNERS file in the repo
  owners: string[];
}

export async function getCodeownersEntries({
  content,
  htmlUrl,
}: {
  content: string;
  htmlUrl: string;
}): Promise<CodeownersEntry[]> {
  const lines = content.split("\n");
  const entries: CodeownersEntry[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue; // Skip empty lines and comments
    }

    const [patternStr, ...owners] = trimmed.split(/\s+/);
    const codeownersPattern = new CodeownersPattern(patternStr);
    const htmlLineUrl = htmlUrl ? `${htmlUrl}#L${index + 1}` : undefined;
    entries.push({
      rawLine: line,
      rawPattern: patternStr,
      rawOwners: owners.join(" "),
      pattern: codeownersPattern,
      owners,
      lineNumber: index + 1,
      htmlLineUrl,
    });
  }

  return entries;
}

export type CodeOwnersToFilesMap = Map<CodeownersEntry, string[]>;

export function processChangedFiles(
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
      `File: ${file} matched pattern: ${lastEntry.rawPattern} with owners: ${lastEntry.rawOwners} (${lastEntry.lineNumber})`,
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
