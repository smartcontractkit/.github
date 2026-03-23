import * as core from "@actions/core";
import micromatch from "micromatch";

import type { TriggerConfig } from "./schema";

export type { FileSets, TriggerConfig } from "./schema";

export interface TriggerResult {
  name: string;
  matched: boolean;
  candidateCount: number;
  matchedFiles: string[];
}

/**
 * Applies a single trigger to the full set of changed files.
 *
 * Semantics:
 * 1. Start with all changed files.
 * 2. Remove any files that match a negated pattern (exclusion pass).
 * 3. Check if any remaining file matches any positive pattern.
 * 4. Return matched=true if at least one file matched.
 */
export function applyTrigger(
  changedFiles: string[],
  trigger: TriggerConfig,
): TriggerResult {
  // Step 1: Exclusion pass — remove files matching any negated pattern.
  let candidates = changedFiles;
  if (trigger.negatedPatterns.length > 0) {
    candidates = changedFiles.filter((f) => {
      const match = micromatch.isMatch(f, trigger.negatedPatterns, {
        dot: true,
      });
      if (match) {
        core.debug(
          `[trigger: ${trigger.name}] excluding file "${f}" due to negated patterns`,
        );
        return false;
      }
      return true;
    });
    const excluded = changedFiles.length - candidates.length;
    core.info(
      `[trigger: ${trigger.name}] exclusion pass: ${excluded} file(s) removed, ${candidates.length} remain`,
    );
  }

  // Step 2: Positive match pass — check remaining candidates against positive patterns.
  const matchedFiles = micromatch(candidates, trigger.positivePatterns, {
    dot: true,
  });
  const matched = matchedFiles.length > 0;

  core.info(
    `[trigger: ${trigger.name}] ${matched ? "MATCHED" : "no match"} ` +
      `(${candidates.length} candidates, ${matchedFiles.length} matched)`,
  );
  if (matchedFiles.length > 0) {
    core.debug(
      `[trigger: ${trigger.name}] matched files: ${JSON.stringify(matchedFiles)}`,
    );
  }

  return {
    name: trigger.name,
    matched,
    candidateCount: candidates.length,
    matchedFiles,
  };
}
