/**
 * Prompt template for merge conflict resolution.
 *
 * The template is embedded directly so it ships with the compiled action
 * bundle -- no external file dependencies.
 */

export interface PromptOptions {
  baseBranch: string;
  prBranch: string;
  conflictBrief: string;
}

export const PROMPT_TEMPLATE = `# Merge Conflict Resolution

You are resolving merge conflicts in a Git repository. The PR branch \`{{PR_BRANCH}}\` has merge conflicts with the base branch \`{{BASE_BRANCH}}\`.

## Core Principle

A conflict is not a "choose ours/theirs" problem -- it is an **intent reconciliation** problem. You must understand the intent of both changes before resolving anything.

- Often the right answer is "keep the intent of both changes", which may require edits that combine or restructure content.
- When the PR branch has a more careful or correct implementation (e.g., deterministic iteration instead of random map order, explicit error handling instead of implicit), prefer it -- the PR branch represents active, intentional development work.
- Do NOT "resolve" by deleting sections just to make conflicts disappear.

## Conflict Metadata

The following has been pre-extracted. The **Conflict Regions** section contains the actual conflict markers from each file -- use this to plan your resolution before reading any files. Pay close attention to **Cross-File Code Movements**, which identify hidden issues beyond the conflict markers.

{{CONFLICT_BRIEF}}

## Time Budget

You have a hard time limit. Two rules to avoid wasting it:

- **Do NOT use TodoWrite or task management tools.** Work through files directly.
- **Batch your \`git add\` calls** -- stage all resolved files at the end, not after each edit.

The pre-extracted conflict regions above let you plan your resolution strategy before reading any files. Use them. Avoid re-reading file sections you have already seen, and avoid reading files in small sequential chunks -- read what you need in one pass. Prioritize conflicted files first; then scan auto-merged files for Go map iteration bugs (see "Go map iteration" pattern below) and any issues flagged in the cross-file movements section.

## Workflow

### Step 1: Plan

Review the conflict regions above. For each file, decide how to reconcile both sides' intent. For trivial conflicts (e.g., \`context.Background()\` vs \`t.Context()\`), you can resolve immediately without further reading. For complex conflicts, brief per-file notes are fine -- just don't produce a lengthy structured analysis for every file.

### Step 2: Resolve

For each conflicted file:

1. **Read the file** to see full context around conflict markers.
2. **Edit** to combine both sides' intent. Remove ALL conflict markers.
3. Move to the next file.

For **cross-file code movements** (if listed above):
- Read the destination file(s) where the base branch moved the code.
- Port the PR branch's additions to the new file location.
- Do NOT keep moved code in the original file if the base branch intentionally removed it.
- Do NOT silently drop functionality because the file it was in no longer exists or was restructured.

### Step 3: Stage and verify

1. \`git add\` all resolved files.
2. Run \`git diff --check\` and grep for leftover \`<<<<<<<\`, \`=======\`, \`>>>>>>>\` markers.
3. **Variable shadowing (Go)**: Check that you haven't introduced \`:=\` where the variable is already declared in an outer scope. Use \`=\` instead.
4. **Review the final diff**: Confirm both sides' intent is preserved in the result.

Do NOT commit -- only stage.

## Common Conflict Patterns

### Import conflicts
Combine imports from both sides, removing duplicates.

### Function/method changes
If both branches modify the same function, understand what each modification achieves. Combine the logic if compatible. If incompatible, prefer the PR branch's version but preserve base branch additions that don't conflict.

### Cross-file refactoring (CRITICAL)
If the base branch moved, renamed, or restructured code that the PR branch modified:
- The "Cross-File Code Movements" section above identifies these cases.
- Port the PR branch's additions and changes to the **new** file location.
- Do NOT silently drop functionality because the file it was in no longer exists or was restructured.
- Do NOT keep the old code in the original file if the base branch intentionally removed it.
- This is the single most common source of AI merge errors.

### Conditional feature flags
When the PR branch wraps new functionality behind a config check (e.g., \`if cfg.XYZ().XYZEnabled()\`), preserve the conditional -- do not flatten it into unconditional calls. If you are porting PR branch options to a new code location introduced by the base branch, rebuild the same conditional structure. Common pattern: the PR branch builds an options slice and conditionally appends feature-flag options; the base branch restructured where the options are applied. Combine both by rebuilding the conditional option-building in the new location.

### Go map iteration and deterministic ordering (auto-merged files)
Go map iteration order is random. If any auto-merged file iterates a map to assign sequential IDs (e.g., \`shardID++\` in a \`for range\` over a map), the result is non-deterministic. Fix this by sorting the map keys before iterating. This is especially important in shard/replica assignment code where callers expect IDs to match a known order. **Check auto-merged files for this pattern even if they have no conflict markers.**

### Semantic preference
If both branches modified the same logic but the PR branch's version is more correct (e.g., deterministic iteration vs random map order, explicit error handling vs implicit), prefer the PR branch even if the base branch's version appears simpler.

### go.mod / go.sum dependency conflicts
These are mechanical -- do not try to infer "intent". Apply these rules:

1. **PR pins a dependency to a non-main-branch commit** (e.g., a feature branch or pre-merge SHA): keep the PR's version. The developer intends to merge that upstream repo later.
2. **Both sides point to main-branch commits but the base branch is newer**: take the base branch's (newer) version. This is the most common case, especially for \`chainlink-common\` and modules in \`chainlink-protos\`.
3. **New dependencies added by one side**: include them.
4. **\`go.sum\` conflicts**: after resolving \`go.mod\`, run \`go mod tidy\` if the Go toolchain is available. If not, take the union of both sides' \`go.sum\` entries.

To determine whether a commit is on main: check the per-file branch history above. If the base branch's log shows a version bump PR (e.g., "bump chain plugin versions", "sync dependency pins"), the base branch commit is newer and should be preferred.

### Configuration and version bumps
Merge configuration options from both sides, removing duplicates. For version bumps, generally take the higher version.

### Variable declarations (Go-specific)
Do not introduce \`:=\` (short variable declaration) when the variable is already declared in an outer scope. Use \`=\` (assignment) to avoid shadowing errors that \`go vet\` will catch.

## Output

When complete, list:
- The files you resolved and how (one line each)
- Any auto-merged files you corrected and why
- Any files flagged as **needs human review** (where intents were contradictory or resolution was uncertain)`;

export function loadPrompt(options: PromptOptions): string {
  let prompt = PROMPT_TEMPLATE;
  prompt = prompt.replace(/\{\{BASE_BRANCH\}\}/g, options.baseBranch);
  prompt = prompt.replace(/\{\{PR_BRANCH\}\}/g, options.prBranch);
  prompt = prompt.replace(/\{\{CONFLICT_BRIEF\}\}/g, options.conflictBrief);
  return prompt;
}
