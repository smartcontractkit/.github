import * as core from "@actions/core";
import { parse as parseYaml } from "yaml";
import micromatch from "micromatch";

export interface TriggerConfig {
  name: string;
  /** Glob patterns (with leading `!` stripped) used to exclude files from the candidate set. */
  negatedPatterns: string[];
  /** Glob patterns that a remaining candidate file must match for this trigger to be true. */
  positivePatterns: string[];
  /**
   * Event names (e.g. "schedule", "workflow_dispatch") for which this trigger
   * always outputs true, bypassing file-change matching entirely.
   * Defaults to ["schedule", "workflow_dispatch"] when not specified.
   */
  alwaysTriggerOn: string[];
}

export interface TriggerResult {
  name: string;
  matched: boolean;
  candidateCount: number;
  matchedFiles: string[];
}

// A map of file-set name → flat list of glob patterns (may include negated patterns).
export type FileSets = Record<string, string[]>;

const DEFAULT_ALWAYS_TRIGGER_ON = ["schedule", "workflow_dispatch"];

// Parses the file-sets input into a FileSets map.
//
// Expected YAML format:
//   go-files:
//     - "**/*.go"
//     - "**/go.mod"
//   ignored-paths:
//     - "!system-tests/**"
//
// Returns an empty map if fileSetsYaml is empty.
// Throws on malformed input.
export function parseFileSets(fileSetsYaml: string): FileSets {
  if (!fileSetsYaml.trim()) return {};

  let parsed: unknown;
  try {
    parsed = parseYaml(fileSetsYaml);
  } catch (e) {
    throw new Error(`Failed to parse file-sets YAML: ${e}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "file-sets input must be a YAML mapping of file-set names to pattern lists.",
    );
  }

  const fileSets: FileSets = {};

  for (const [name, rawPatterns] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (!Array.isArray(rawPatterns)) {
      throw new Error(
        `File-set "${name}" must be a list of glob patterns, got: ${typeof rawPatterns}`,
      );
    }

    fileSets[name] = rawPatterns
      .map((p, i) => {
        if (typeof p !== "string") {
          throw new Error(
            `File-set "${name}": pattern at index ${i} must be a string, got: ${typeof p}`,
          );
        }
        return p.trim();
      })
      .filter((p) => p.length > 0);
  }

  return fileSets;
}

// Parses the triggers input into a list of TriggerConfig objects, resolving any
// file-set references against the provided file-sets map.
//
// Expected YAML format:
//   deployment-tests:
//     file-sets: [ignored-paths, go-files]
//     paths:
//       - "deployment/**"
//     always-trigger-on:
//       - schedule
//       - workflow_dispatch
//
// Both `file-sets` and `paths` are optional, but each trigger must have at
// least one of them, and the combined set of patterns must include at least one
// positive (non-negated) pattern.
//
// `always-trigger-on` is optional and defaults to ["schedule", "workflow_dispatch"].
// Patterns starting with ! are exclusion patterns applied before positive matching.
//
// Throws on malformed input or unresolved file-set references.
export function parseTriggers(
  triggersYaml: string,
  fileSets: FileSets = {},
): TriggerConfig[] {
  let parsed: unknown;
  try {
    parsed = parseYaml(triggersYaml);
  } catch (e) {
    throw new Error(`Failed to parse triggers YAML: ${e}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "triggers input must be a YAML mapping of trigger names to their configuration.",
    );
  }

  const triggers: TriggerConfig[] = [];

  for (const [name, rawConfig] of Object.entries(
    parsed as Record<string, unknown>,
  )) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("Trigger names must be non-empty strings.");
    }

    if (
      typeof rawConfig !== "object" ||
      rawConfig === null ||
      Array.isArray(rawConfig)
    ) {
      throw new Error(
        `Trigger "${name}" must be a mapping with "paths" and/or "file-sets" keys, got: ${typeof rawConfig}`,
      );
    }

    const config = rawConfig as Record<string, unknown>;

    for (const key of Object.keys(config)) {
      if (
        key !== "paths" &&
        key !== "file-sets" &&
        key !== "always-trigger-on"
      ) {
        throw new Error(
          `Trigger "${name}" has unknown key "${key}". Only "paths", "file-sets", and "always-trigger-on" are allowed.`,
        );
      }
    }

    // Resolve file-set references into patterns.
    const fileSetPatterns: string[] = [];
    if (config["file-sets"] !== undefined) {
      if (!Array.isArray(config["file-sets"])) {
        throw new Error(
          `Trigger "${name}"."file-sets" must be a list of file-set names, got: ${typeof config["file-sets"]}`,
        );
      }
      for (const setName of config["file-sets"]) {
        if (typeof setName !== "string") {
          throw new Error(
            `Trigger "${name}"."file-sets" entries must be strings, got: ${typeof setName}`,
          );
        }
        if (!(setName in fileSets)) {
          throw new Error(
            `Trigger "${name}" references unknown file-set "${setName}".`,
          );
        }
        fileSetPatterns.push(...fileSets[setName]);
      }
    }

    // Parse explicit paths.
    const pathPatterns: string[] = [];
    if (config.paths !== undefined) {
      if (!Array.isArray(config.paths)) {
        throw new Error(
          `Trigger "${name}".paths must be a list of glob patterns, got: ${typeof config.paths}`,
        );
      }
      for (let i = 0; i < config.paths.length; i++) {
        const p = config.paths[i];
        if (typeof p !== "string") {
          throw new Error(
            `Trigger "${name}".paths[${i}] must be a string, got: ${typeof p}`,
          );
        }
        const trimmed = p.trim();
        if (trimmed.length > 0) pathPatterns.push(trimmed);
      }
    }

    // Parse always-trigger-on, defaulting to schedule + workflow_dispatch.
    let alwaysTriggerOn: string[] = DEFAULT_ALWAYS_TRIGGER_ON;
    if (config["always-trigger-on"] !== undefined) {
      if (!Array.isArray(config["always-trigger-on"])) {
        throw new Error(
          `Trigger "${name}"."always-trigger-on" must be a list of event names, got: ${typeof config["always-trigger-on"]}`,
        );
      }
      alwaysTriggerOn = [];
      for (let i = 0; i < config["always-trigger-on"].length; i++) {
        const ev = config["always-trigger-on"][i];
        if (typeof ev !== "string") {
          throw new Error(
            `Trigger "${name}"."always-trigger-on"[${i}] must be a string, got: ${typeof ev}`,
          );
        }
        const trimmed = ev.trim();
        if (trimmed.length > 0) alwaysTriggerOn.push(trimmed);
      }
    }

    // File-sets first, then explicit paths.
    const allPatterns = [...fileSetPatterns, ...pathPatterns];

    const negatedPatterns = allPatterns
      .filter((p) => p.startsWith("!"))
      .map((p) => p.slice(1));

    const positivePatterns = allPatterns.filter((p) => !p.startsWith("!"));

    // If patterns were provided but are all negated, that's always a mistake —
    // negated patterns alone can never produce a match for file-change events.
    if (allPatterns.length > 0 && positivePatterns.length === 0) {
      throw new Error(
        `Trigger "${name}" has only negated patterns. At least one non-negated pattern is required` +
          ` for file-change matching. To skip file matching entirely, omit "paths" and "file-sets"` +
          ` and rely solely on "always-trigger-on".`,
      );
    }

    // A trigger with no patterns and an empty always-trigger-on can never output
    // true, which is always a configuration mistake.
    if (allPatterns.length === 0 && alwaysTriggerOn.length === 0) {
      throw new Error(
        `Trigger "${name}" has no patterns and an empty "always-trigger-on". ` +
          `It can never output true. Add "paths"/"file-sets" for file-change matching, ` +
          `or add event names to "always-trigger-on".`,
      );
    }

    triggers.push({ name, negatedPatterns, positivePatterns, alwaysTriggerOn });
  }

  if (triggers.length === 0) {
    throw new Error("No triggers defined in the triggers input.");
  }

  return triggers;
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
  core.info(
    `[trigger: ${trigger.name}] negated patterns: ${JSON.stringify(trigger.negatedPatterns)}`,
  );
  core.info(
    `[trigger: ${trigger.name}] positive patterns: ${JSON.stringify(trigger.positivePatterns)}`,
  );

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
