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

// A map of category name → flat list of glob patterns (may include negated patterns).
export type Categories = Record<string, string[]>;

// Parses the categories input into a Categories map.
//
// Expected YAML format:
//   go-files:
//     - "**/*.go"
//     - "**/go.mod"
//   ignored-paths:
//     - "!system-tests/**"
//
// Returns an empty map if categoriesYaml is empty.
// Throws on malformed input.
export function parseCategories(categoriesYaml: string): Categories {
  if (!categoriesYaml.trim()) return {};

  let parsed: unknown;
  try {
    parsed = parseYaml(categoriesYaml);
  } catch (e) {
    throw new Error(`Failed to parse categories YAML: ${e}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "categories input must be a YAML mapping of category names to pattern lists.",
    );
  }

  const categories: Categories = {};

  for (const [name, rawPatterns] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!Array.isArray(rawPatterns)) {
      throw new Error(
        `Category "${name}" must be a list of glob patterns, got: ${typeof rawPatterns}`,
      );
    }

    categories[name] = rawPatterns
      .map((p, i) => {
        if (typeof p !== "string") {
          throw new Error(
            `Category "${name}": pattern at index ${i} must be a string, got: ${typeof p}`,
          );
        }
        return p.trim();
      })
      .filter((p) => p.length > 0);
  }

  return categories;
}

// Parses the filters input into a list of FilterConfig objects, resolving any
// category references against the provided categories map.
//
// Expected YAML format:
//   core-tests:
//     categories: [ignored-paths, go-files]
//     paths:
//       - "tools/bin/go_core_tests"
//
// Both `categories` and `paths` are optional, but each filter must have at
// least one of them, and the combined set of patterns must include at least one
// positive (non-negated) pattern.
//
// Throws on malformed input or unresolved category references.
export function parseFilters(
  filtersYaml: string,
  categories: Categories = {},
): FilterConfig[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(filtersYaml);
  } catch (e) {
    throw new Error(`Failed to parse filters YAML: ${e}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "filters input must be a YAML mapping of filter names to their configuration.",
    );
  }

  const filters: FilterConfig[] = [];

  for (const [name, rawConfig] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("Filter names must be non-empty strings.");
    }

    if (
      typeof rawConfig !== "object" ||
      rawConfig === null ||
      Array.isArray(rawConfig)
    ) {
      throw new Error(
        `Filter "${name}" must be a mapping with "paths" and/or "categories" keys, got: ${typeof rawConfig}`,
      );
    }

    const config = rawConfig as Record<string, unknown>;

    for (const key of Object.keys(config)) {
      if (key !== "paths" && key !== "categories") {
        throw new Error(
          `Filter "${name}" has unknown key "${key}". Only "paths" and "categories" are allowed.`,
        );
      }
    }

    if (config.paths === undefined && config.categories === undefined) {
      throw new Error(
        `Filter "${name}" must have at least one of "paths" or "categories".`,
      );
    }

    // Resolve category references into patterns.
    const categoryPatterns: string[] = [];
    if (config.categories !== undefined) {
      if (!Array.isArray(config.categories)) {
        throw new Error(
          `Filter "${name}".categories must be a list of category names, got: ${typeof config.categories}`,
        );
      }
      for (const catName of config.categories) {
        if (typeof catName !== "string") {
          throw new Error(
            `Filter "${name}".categories entries must be strings, got: ${typeof catName}`,
          );
        }
        if (!(catName in categories)) {
          throw new Error(
            `Filter "${name}" references unknown category "${catName}".`,
          );
        }
        categoryPatterns.push(...categories[catName]);
      }
    }

    // Parse explicit paths.
    const pathPatterns: string[] = [];
    if (config.paths !== undefined) {
      if (!Array.isArray(config.paths)) {
        throw new Error(
          `Filter "${name}".paths must be a list of glob patterns, got: ${typeof config.paths}`,
        );
      }
      for (let i = 0; i < config.paths.length; i++) {
        const p = config.paths[i];
        if (typeof p !== "string") {
          throw new Error(
            `Filter "${name}".paths[${i}] must be a string, got: ${typeof p}`,
          );
        }
        const trimmed = p.trim();
        if (trimmed.length > 0) pathPatterns.push(trimmed);
      }
    }

    // Categories first, then explicit paths.
    const allPatterns = [...categoryPatterns, ...pathPatterns];

    const negatedPatterns = allPatterns
      .filter((p) => p.startsWith("!"))
      .map((p) => p.slice(1));

    const positivePatterns = allPatterns.filter((p) => !p.startsWith("!"));

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
