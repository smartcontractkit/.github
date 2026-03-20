import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInvokeContext, getInputs } from "./run-inputs";
import {
  parseFileSets,
  parseTriggers,
  applyTrigger,
  TriggerResult,
} from "./filters";
import { getChangedFilesGit } from "./git";
import { getChangedFilesForPR } from "./github";
import type { OctokitType } from "./github";
import type { FileChangeEventData } from "./event";

interface Outputs {
  triggerResults: TriggerResult[];
}

function setOutputs(outputs: Outputs) {
  const { triggerResults } = outputs;

  const matched = triggerResults.filter((r) => r.matched).map((r) => r.name);
  const notMatched = triggerResults
    .filter((r) => !r.matched)
    .map((r) => r.name);

  const any = matched.length > 0;

  // Dynamic per-trigger outputs.
  for (const result of triggerResults) {
    const value = result.matched ? "true" : "false";
    core.info(`(output) ${result.name}: ${value}`);
    core.setOutput(result.name, value);
  }

  // Aggregate outputs.
  core.info(`(output) any: ${any}`);
  core.setOutput("any", String(any));

  const triggersMatchedCsv = matched.join(",");
  core.info(`(output) triggers-matched: ${triggersMatchedCsv}`);
  core.setOutput("triggers-matched", triggersMatchedCsv);

  const triggersNotMatchedCsv = notMatched.join(",");
  core.info(`(output) triggers-not-matched: ${triggersNotMatchedCsv}`);
  core.setOutput("triggers-not-matched", triggersNotMatchedCsv);

  const triggersMatchedJson = JSON.stringify(matched);
  core.info(`(output) triggers-matched-json: ${triggersMatchedJson}`);
  core.setOutput("triggers-matched-json", triggersMatchedJson);

  const triggersNotMatchedJson = JSON.stringify(notMatched);
  core.info(`(output) triggers-not-matched-json: ${triggersNotMatchedJson}`);
  core.setOutput("triggers-not-matched-json", triggersNotMatchedJson);
}

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context.
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    const inputs = getInputs();
    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Parse file-sets and triggers.
    core.startGroup("Parsing triggers");
    const fileSets = parseFileSets(inputs.fileSets);
    const triggers = parseTriggers(inputs.triggers, fileSets);
    core.info(
      `Parsed ${triggers.length} trigger(s): ${triggers.map((t) => t.name).join(", ")}`,
    );
    core.endGroup();

    // 3. Determine changed files for file-change events.
    core.startGroup("Determining changed files");
    core.info(`Event type: ${context.event.eventName}`);
    let changedFiles: string[] | null = null;
    if (context.event.kind === "file-change") {
      changedFiles = await getChangedFiles(
        octokit,
        { owner: context.owner, repo: context.repo },
        context.event,
        inputs.repositoryRoot,
      );
      core.info(`Changed files count: ${changedFiles.length}`);
      if (core.isDebug()) {
        core.debug(`Changed files: ${JSON.stringify(changedFiles, null, 2)}`);
      }
    } else {
      core.info(
        `Event "${context.event.eventName}" is not a file-change event — skipping changed file detection.`,
      );
    }
    core.endGroup();

    // 4. Apply each trigger.
    core.startGroup("Applying triggers");
    const triggerResults: TriggerResult[] = [];
    for (const trigger of triggers) {
      let result: TriggerResult;

      if (context.event.kind === "file-change") {
        result = applyTrigger(changedFiles!, trigger);
      } else if (trigger.alwaysTriggerOn.includes(context.event.eventName)) {
        core.info(
          `[trigger: ${trigger.name}] event "${context.event.eventName}" is in always-trigger-on → MATCHED`,
        );
        result = {
          name: trigger.name,
          matched: true,
          candidateCount: 0,
          matchedFiles: [],
        };
      } else {
        core.warning(
          `[trigger: ${trigger.name}] event "${context.event.eventName}" is not a file-change event ` +
            `and is not listed in always-trigger-on [${trigger.alwaysTriggerOn.join(", ")}]. Defaulting to false.`,
        );
        result = {
          name: trigger.name,
          matched: false,
          candidateCount: 0,
          matchedFiles: [],
        };
      }

      triggerResults.push(result);
    }
    core.endGroup();

    // 5. Set outputs.
    core.startGroup("Setting outputs");
    setOutputs({ triggerResults });
    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * The GitHub API for pulls.listFiles is documented to return at most this many
 * files. If we get exactly this many back, the list is likely truncated and we
 * fall back to git diff to get the complete set.
 */
const PR_FILES_API_LIMIT = 3000;

/**
 * Dispatches to the appropriate changed-file strategy based on event type.
 *
 * For pull_request events the GitHub API is tried first. Two conditions cause
 * a fallback to `git diff` using the SHAs from the event payload:
 *   - The API returns >= PR_FILES_API_LIMIT files (list is silently truncated).
 *   - The API call fails (e.g. 5xx), logged as a warning rather than a hard failure.
 *
 * The git fallback requires the repository to be checked out at repositoryRoot.
 */
async function getChangedFiles(
  octokit: OctokitType,
  { owner, repo }: { owner: string; repo: string },
  event: FileChangeEventData,
  repositoryRoot: string,
): Promise<string[]> {
  switch (event.eventName) {
    case "pull_request": {
      return getChangedFilesForPRWithFallback(
        octokit,
        owner,
        repo,
        event.prNumber,
        event.base,
        event.head,
        repositoryRoot,
      );
    }

    case "push": {
      core.info("Fetching changed files via git diff (push).");
      return getChangedFilesGit(event.base, event.head, repositoryRoot);
    }

    case "merge_group": {
      core.info("Fetching changed files via git diff (merge_group).");
      return getChangedFilesGit(event.base, event.head, repositoryRoot);
    }

    default:
      event satisfies never; // type guard to ensure all cases are handled
      throw new Error(`Unhandled event: ${JSON.stringify(event)}`);
  }
}

async function getChangedFilesForPRWithFallback(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
  base: string,
  head: string,
  repositoryRoot: string,
): Promise<string[]> {
  core.info("Fetching changed files via GitHub API (pull_request).");

  let apiFiles: string[];
  try {
    const files = await getChangedFilesForPR(octokit, owner, repo, prNumber);
    apiFiles = files.map((f: { filename: string }) => f.filename);
  } catch (err) {
    core.warning(
      `GitHub API request for PR files failed: ${err}. ` +
        `Falling back to git diff (base: ${base}, head: ${head}).`,
    );
    return getChangedFilesGit(base, head, repositoryRoot);
  }

  if (apiFiles.length >= PR_FILES_API_LIMIT) {
    core.warning(
      `GitHub API returned ${apiFiles.length} files, which meets or exceeds the ` +
        `known API limit of ${PR_FILES_API_LIMIT}. The list may be truncated. ` +
        `Falling back to git diff (base: ${base}, head: ${head}).`,
    );
    return getChangedFilesGit(base, head, repositoryRoot);
  }

  core.info(`GitHub API returned ${apiFiles.length} changed file(s).`);
  return apiFiles;
}
