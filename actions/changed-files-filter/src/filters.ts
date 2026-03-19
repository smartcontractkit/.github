import * as core from "@actions/core";
import { parse as parseYaml } from "yaml";
import micromatch from "micromatch";

export interface FilterConfig {
  name: string;
  /** Glob patterns (with leading `!` stripped) used to exclude files from the candidate set. */
  negatedPatterns: string[];
  /** Glob patterns that a remaining candidate file must match for this filter to be true. */
  positivePatterns: string[];
}

export interface FilterResult {
  name: string;
  matched: boolean;
  candidateCount: number;
  matchedFiles: string[];
}

/**
 * Parses the YAML filters input into a list of FilterConfig objects.
 *
 * Expected YAML format:
 *   filterName:
 *     - !excluded/path/**
 *     - included/path/**
 *
 * Throws on malformed input.
 */
export function parseFilters(filtersYaml: string): FilterConfig[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(filtersYaml);
  } catch (e) {
    throw new Error(`Failed to parse filters YAML: ${e}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "filters input must be a YAML mapping of filter names to pattern lists.",
    );
  }

  const filters: FilterConfig[] = [];

  for (const [name, rawPatterns] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("Filter names must be non-empty strings.");
    }

    if (!Array.isArray(rawPatterns)) {
      throw new Error(
        `Filter "${name}" must be a list of glob patterns, got: ${typeof rawPatterns}`,
      );
    }

    const patterns: string[] = rawPatterns
      .map((p, i) => {
        if (typeof p !== "string") {
          throw new Error(
            `Filter "${name}": pattern at index ${i} must be a string, got: ${typeof p}`,
          );
        }
        return p.trim();
      })
      .filter((p) => p.length > 0);

    const negatedPatterns = patterns
      .filter((p) => p.startsWith("!"))
      .map((p) => p.slice(1));

    const positivePatterns = patterns.filter((p) => !p.startsWith("!"));

    if (positivePatterns.length === 0) {
      throw new Error(
        `Filter "${name}" has no positive patterns. At least one non-negated pattern is required.` +
          ` (Negated patterns alone cannot produce a match.)`,
      );
    }

    filters.push({ name, negatedPatterns, positivePatterns });
  }

  if (filters.length === 0) {
    throw new Error("No filters defined in the filters input.");
  }

  return filters;
}

/**
 * Applies a single filter to the full set of changed files.
 *
 * Semantics:
 * 1. Start with all changed files.
 * 2. Remove any files that match a negated pattern (exclusion pass).
 * 3. Check if any remaining file matches any positive pattern.
 * 4. Return matched=true if at least one file matched.
 */
export function applyFilter(
  changedFiles: string[],
  filter: FilterConfig,
): FilterResult {
  core.info(
    `[filter: ${filter.name}] negated patterns: ${JSON.stringify(filter.negatedPatterns)}`,
  );
  core.info(
    `[filter: ${filter.name}] positive patterns: ${JSON.stringify(filter.positivePatterns)}`,
  );

  // Step 1: Exclusion pass — remove files matching any negated pattern.
  let candidates = changedFiles;
  if (filter.negatedPatterns.length > 0) {
    candidates = changedFiles.filter((f) => {
      const match = micromatch.isMatch(f, filter.negatedPatterns, {
        dot: true,
      });
      if (match) {
        core.debug(
          `[filter: ${filter.name}] excluding file "${f}" due to negated patterns`,
        );
        return false;
      }

      return true;
    });
    const excluded = changedFiles.length - candidates.length;
    core.info(
      `[filter: ${filter.name}] exclusion pass: ${excluded} file(s) removed, ${candidates.length} remain`,
    );
  }

  // Step 2: Positive match pass — check remaining candidates against positive patterns.
  const matchedFiles = micromatch(candidates, filter.positivePatterns, {
    dot: true,
  });
  const matched = matchedFiles.length > 0;

  core.info(
    `[filter: ${filter.name}] ${matched ? "MATCHED" : "no match"} ` +
      `(${candidates.length} candidates, ${matchedFiles.length} matched)`,
  );
  if (matchedFiles.length > 0) {
    core.debug(
      `[filter: ${filter.name}] matched files: ${JSON.stringify(matchedFiles)}`,
    );
  }

  return {
    name: filter.name,
    matched,
    candidateCount: candidates.length,
    matchedFiles,
  };
}
