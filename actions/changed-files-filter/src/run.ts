import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInvokeContext, getInputs } from "./run-inputs";
import { parseCategories, parseFilters, applyFilter, FilterResult } from "./filters";
import { getChangedFilesGit } from "./git";
import { getChangedFilesForPR } from "./github";
import type { OctokitType } from "./github";
import type { InvokeContext } from "./run-inputs";

interface Outputs {
  filterResults: FilterResult[];
}

function setOutputs(outputs: Outputs) {
  const { filterResults } = outputs;

  const matched = filterResults.filter((r) => r.matched).map((r) => r.name);
  const notMatched = filterResults.filter((r) => !r.matched).map((r) => r.name);

  const any = matched.length > 0;

  // Dynamic per-filter outputs.
  for (const result of filterResults) {
    const value = result.matched ? "true" : "false";
    core.info(`(output) ${result.name}: ${value}`);
    core.setOutput(result.name, value);
  }

  // Aggregate outputs.
  core.info(`(output) any: ${any}`);
  core.setOutput("any", String(any));

  const filtersMatchedCsv = matched.join(",");
  core.info(`(output) filters-matched: ${filtersMatchedCsv}`);
  core.setOutput("filters-matched", filtersMatchedCsv);

  const filtersNotMatchedCsv = notMatched.join(",");
  core.info(`(output) filters-not-matched: ${filtersNotMatchedCsv}`);
  core.setOutput("filters-not-matched", filtersNotMatchedCsv);

  const filtersMatchedJson = JSON.stringify(matched);
  core.info(`(output) filters-matched-json: ${filtersMatchedJson}`);
  core.setOutput("filters-matched-json", filtersMatchedJson);

  const filtersNotMatchedJson = JSON.stringify(notMatched);
  core.info(`(output) filters-not-matched-json: ${filtersNotMatchedJson}`);
  core.setOutput("filters-not-matched-json", filtersNotMatchedJson);
}

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context.
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    const inputs = getInputs();
    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Parse categories and filters.
    core.startGroup("Parsing filters");
    const categories = parseCategories(inputs.categories);
    const filters = parseFilters(inputs.filters, categories);
    core.info(
      `Parsed ${filters.length} filter(s): ${filters.map((f) => f.name).join(", ")}`,
    );
    core.endGroup();

    // 3. Determine changed files for the current event.
    core.startGroup("Determining changed files");
    core.info(`Event type: ${context.event.eventName}`);
    const changedFiles = await getChangedFiles(
      octokit,
      context,
      inputs.repositoryRoot,
    );
    core.info(`Changed files count: ${changedFiles.length}`);
    if (core.isDebug()) {
      core.debug(`Changed files: ${JSON.stringify(changedFiles, null, 2)}`);
    }
    core.endGroup();

    // 4. Apply each filter.
    core.startGroup("Applying filters");
    const filterResults: FilterResult[] = [];
    for (const filter of filters) {
      const result = applyFilter(changedFiles, filter);
      filterResults.push(result);
    }
    core.endGroup();

    // 5. Set outputs.
    core.startGroup("Setting outputs");
    setOutputs({ filterResults });
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
  { owner, repo, event }: InvokeContext,
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
