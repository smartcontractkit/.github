import * as core from "@actions/core";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const DEFAULT_ALWAYS_TRIGGER_ON = ["schedule", "workflow_dispatch"];

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const path = e.path.length > 0 ? `[${e.path.join(" → ")}] ` : "";
      return `${path}${e.message}`;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// File-sets schema
// ---------------------------------------------------------------------------

const fileSetsMapSchema = z
  .record(z.string(), z.array(z.string()))
  .superRefine((obj, ctx) => {
    for (const [name, patterns] of Object.entries(obj)) {
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].trim().startsWith("!")) {
          ctx.addIssue({
            code: "custom",
            path: [name, i],
            message:
              `Pattern must not be negated. File-sets define sets of files using positive patterns only. ` +
              `To exclude this file-set in a trigger, reference "${name}" in the trigger's "exclusion-sets".`,
          });
        }
      }
    }
  })
  .transform((obj) =>
    Object.fromEntries(
      Object.entries(obj).map(([name, patterns]) => [
        name,
        patterns.map((p) => p.trim()).filter((p) => p.length > 0),
      ]),
    ),
  );

// A map of file-set name → flat list of positive glob patterns.
export type FileSets = z.output<typeof fileSetsMapSchema>;

// ---------------------------------------------------------------------------
// Trigger config schema (resolved output type)
// ---------------------------------------------------------------------------

const triggerConfigSchema = z.object({
  name: z.string(),
  /** Glob patterns (with leading `!` stripped) used to exclude files from the candidate set. */
  negatedPatterns: z.array(z.string()),
  /** Glob patterns that a remaining candidate file must match for this trigger to be true. */
  positivePatterns: z.array(z.string()),
  /**
   * Event names (e.g. "schedule", "workflow_dispatch") for which this trigger
   * always outputs true, bypassing file-change matching entirely.
   * Defaults to ["schedule", "workflow_dispatch"] when not specified.
   */
  alwaysTriggerOn: z.array(z.string()),
});

export type TriggerConfig = z.infer<typeof triggerConfigSchema>;

// ---------------------------------------------------------------------------
// Triggers (raw input) schema
// ---------------------------------------------------------------------------

const ALLOWED_TRIGGER_KEYS = new Set([
  "inclusion-sets",
  "exclusion-sets",
  "paths",
  "always-trigger-on",
]);

// Uses passthrough so unknown keys flow through to the outer superRefine,
// where they are reported with full context (trigger name + allowed key list).
const triggerRawSchema = z
  .object({
    "inclusion-sets": z.array(z.string()).optional(),
    "exclusion-sets": z.array(z.string()).optional(),
    paths: z.array(z.string()).optional(),
    "always-trigger-on": z.array(z.string()).optional(),
  })
  .passthrough();

// Explicit type for use after validation — excludes the passthrough index signature.
type TriggerRaw = {
  "inclusion-sets"?: string[];
  "exclusion-sets"?: string[];
  paths?: string[];
  "always-trigger-on"?: string[];
};

function buildTriggersSchema(fileSets: FileSets) {
  return z.record(z.string(), triggerRawSchema).superRefine((triggers, ctx) => {
    if (Object.keys(triggers).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "No triggers defined in the triggers input.",
      });
      return;
    }

    for (const [name, config] of Object.entries(triggers)) {
      // Check for unknown keys with a helpful message listing allowed keys.
      for (const key of Object.keys(config)) {
        if (!ALLOWED_TRIGGER_KEYS.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: [name, key],
            message: `Unknown key "${key}". Allowed keys: "inclusion-sets", "exclusion-sets", "paths", "always-trigger-on".`,
          });
        }
      }
      validateTrigger(name, config as TriggerRaw, fileSets, ctx);
    }
  });
}

function validateTrigger(
  name: string,
  config: TriggerRaw,
  fileSets: FileSets,
  ctx: z.RefinementCtx,
): void {
  // Validate file-set references in inclusion-sets.
  for (const [i, setName] of (config["inclusion-sets"] ?? []).entries()) {
    if (!(setName in fileSets)) {
      ctx.addIssue({
        code: "custom",
        path: [name, "inclusion-sets", i],
        message: `unknown file-set "${setName}" in "inclusion-sets".`,
      });
    }
  }

  // Validate file-set references in exclusion-sets.
  for (const [i, setName] of (config["exclusion-sets"] ?? []).entries()) {
    if (!(setName in fileSets)) {
      ctx.addIssue({
        code: "custom",
        path: [name, "exclusion-sets", i],
        message: `unknown file-set "${setName}" in "exclusion-sets".`,
      });
    }
  }

  // Semantic: determine whether positive patterns exist at source level.
  const hasInclusionSets = (config["inclusion-sets"]?.length ?? 0) > 0;
  const hasExclusionSets = (config["exclusion-sets"]?.length ?? 0) > 0;
  const trimmedPaths = (config.paths ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const positivePaths = trimmedPaths.filter((p) => !p.startsWith("!"));

  const hasPatternSources =
    hasInclusionSets || hasExclusionSets || trimmedPaths.length > 0;
  const hasPositivePatterns = hasInclusionSets || positivePaths.length > 0;

  const alwaysTriggerOn = (
    config["always-trigger-on"] ?? DEFAULT_ALWAYS_TRIGGER_ON
  )
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (hasPatternSources && !hasPositivePatterns) {
    ctx.addIssue({
      code: "custom",
      path: [name],
      message:
        `Has only negated patterns. At least one non-negated pattern is required for file-change matching. ` +
        `To skip file matching entirely, omit "inclusion-sets" and "paths" and rely solely on "always-trigger-on".`,
    });
  }

  if (!hasPatternSources && alwaysTriggerOn.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: [name],
      message:
        `Has no patterns and an empty "always-trigger-on". It can never output true. ` +
        `Add "inclusion-sets"/"paths" for file-change matching, or add event names to "always-trigger-on".`,
    });
  }
}

// ---------------------------------------------------------------------------
// Public parse functions
// ---------------------------------------------------------------------------

// Parses the file-sets input into a FileSets map.
//
// Expected YAML format:
//   go-files:
//     - "**/*.go"
//     - "**/go.mod"
//   vendor:
//     - "**/vendor/**"
//
// File-sets must contain only positive patterns. Negation (`!`) is not allowed
// inside file-set definitions — to exclude a file-set in a trigger, reference
// it via "exclusion-sets" instead.
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

  const result = fileSetsMapSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

// Parses the triggers input into a list of TriggerConfig objects, resolving any
// file-set references against the provided file-sets map.
//
// Expected YAML format:
//   deployment-tests:
//     inclusion-sets: [go-files, workflow-files]
//     exclusion-sets: [vendor-paths]
//     paths:
//       - "deployment/**"
//     always-trigger-on:
//       - schedule
//       - workflow_dispatch
//
// `inclusion-sets`, `exclusion-sets`, and `paths` are all optional. Patterns
// from `inclusion-sets` are treated as positive patterns; patterns from
// `exclusion-sets` are treated as negated patterns (excluded before matching).
// Inline `paths` entries may also use `!` for one-off exclusions.
//
// `always-trigger-on` is optional and defaults to ["schedule", "workflow_dispatch"].
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

  const schema = buildTriggersSchema(fileSets);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  const triggers: TriggerConfig[] = [];

  for (const [name, config] of Object.entries(result.data)) {
    // Resolve inclusion-sets → positive patterns.
    const inclusionPatterns = (config["inclusion-sets"] ?? []).flatMap(
      (s) => fileSets[s] ?? [],
    );

    // Resolve exclusion-sets → negated patterns.
    const exclusionPatterns = (config["exclusion-sets"] ?? []).flatMap((s) =>
      (fileSets[s] ?? []).map((p) => `!${p}`),
    );

    // Inline paths (may include `!` negations), trimmed and blank-filtered.
    const pathPatterns = (config.paths ?? [])
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const allPatterns = [
      ...inclusionPatterns,
      ...exclusionPatterns,
      ...pathPatterns,
    ];

    const triggerConfig: TriggerConfig = {
      name,
      negatedPatterns: allPatterns
        .filter((p) => p.startsWith("!"))
        .map((p) => p.slice(1)),
      positivePatterns: allPatterns.filter((p) => !p.startsWith("!")),
      alwaysTriggerOn: (
        config["always-trigger-on"] ?? DEFAULT_ALWAYS_TRIGGER_ON
      )
        .map((e) => e.trim())
        .filter((e) => e.length > 0),
    };

    core.info(
      `[trigger: ${name}] resolved config: ${JSON.stringify(triggerConfig, null, 2)}`,
    );

    triggers.push(triggerConfig);
  }

  return triggers;
}
