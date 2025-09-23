import * as github from "@actions/github";
import * as core from "@actions/core";

import { Octokit } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";

import { getInvokeContext, getInputs } from "./run-inputs";
import {
  getChangedFilesForPR,
  getCodeownersFile,
  getSummaryUrl,
  upsertPRComment,
} from "./github";
import {
  getCodeownersEntries,
  processChangedFiles as processChangedFiles,
} from "./codeowners";
import { getCurrentReviewStatus } from "./github-gql";
import {
  formatPendingReviewsMarkdown,
  formatAllReviewsSummaryByEntry,
} from "./strings";
import {
  PullRequestReviewStateExt,
  getOverallState,
  getReviewForStatusFor,
} from "./review-status";
import { calculateAllMinimumHittingSets } from "./hitting-sets";

import type { OwnerReviewStatus } from "./review-status";
import type { CodeownersEntry, CodeOwnersToFilesMap } from "./codeowners";
import type { CurrentReviewStatus } from "./github-gql";

export type ProcessedCodeOwnersEntry = {
  files: string[];
  ownerReviewStatuses: OwnerReviewStatus[];
  overallStatus: PullRequestReviewStateExt;
};

export async function run(): Promise<void> {
  try {
    core.startGroup("Context");
    const context = getInvokeContext();
    const octokit = github.getOctokit(context.token);
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);
    const inputs = getInputs();
    core.debug(`Inputs: ${JSON.stringify(inputs)}`);
    core.endGroup();

    const { token, owner, repo, prNumber } = context;

    core.startGroup("Get changed files for PR");
    const prFiles = await getChangedFilesForPR(octokit, owner, repo, prNumber);
    const filenames = prFiles.map((f) => f.filename);
    core.info(`Found ${filenames.length} changed files in PR #${prNumber}.`);
    core.debug(`Changed files: ${JSON.stringify(filenames, null, 2)}`);
    core.endGroup();

    core.startGroup("CODEOWNERS Preparation");
    const codeownersFile = await getCodeownersFile(octokit, owner, repo);
    if (!codeownersFile?.content) {
      core.warning(
        "No CODEOWNERS file found in the repository. Skipping analysis.",
      );
      return;
    }
    const codeownersEntries = await getCodeownersEntries(codeownersFile);
    core.info(`Found ${codeownersEntries.length} CODEOWNERS entries.`);
    if (codeownersEntries.length === 0) {
      core.warning(
        "No CODEOWNERS file found, or it is empty. Skipping analysis.",
      );
      return;
    }
    core.endGroup();

    core.startGroup("Analyze file paths and codeowners patterns");
    const { unownedFiles, codeOwnersEntryToFiles } = processChangedFiles(
      filenames,
      codeownersEntries,
    );
    core.endGroup();

    core.startGroup("Get currrent state of PR reviews");
    const OctokitWithGQLPagination = Octokit.plugin(paginateGraphQL);
    const octokitGQL = new OctokitWithGQLPagination({ auth: token });
    const currentPRReviewState = await getCurrentReviewStatus(
      octokitGQL,
      owner,
      repo,
      prNumber,
    );

    core.debug(JSON.stringify(currentPRReviewState));
    core.endGroup();

    core.startGroup("Create CODEOWNERS Summary");
    const codeownersSummary = createReviewSummaryObject(
      currentPRReviewState,
      codeOwnersEntryToFiles,
    );

    const minimumHittingSets =
      calculateAllMinimumHittingSets(codeownersSummary);
    await formatAllReviewsSummaryByEntry(codeownersSummary, minimumHittingSets);
    const summaryUrl = await getSummaryUrl(octokit, owner, repo);
    const pendingReviewMarkdown = formatPendingReviewsMarkdown(
      codeownersSummary,
      summaryUrl,
      minimumHittingSets,
    );
    core.debug(`Pending review markdown:\n${pendingReviewMarkdown}`);
    if (inputs.postComment) {
      await upsertPRComment(
        octokit,
        owner,
        repo,
        prNumber,
        pendingReviewMarkdown,
      );
    }
    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

function createReviewSummaryObject(
  currentReviewStatus: CurrentReviewStatus,
  codeOwnersEntryToFiles: CodeOwnersToFilesMap,
): Map<CodeownersEntry, ProcessedCodeOwnersEntry> {
  const reviewSummary: Map<CodeownersEntry, ProcessedCodeOwnersEntry> =
    new Map();
  for (const [entry, files] of codeOwnersEntryToFiles.entries()) {
    const ownerReviewStatuses: OwnerReviewStatus[] = [];
    for (const owner of entry.owners) {
      const status = getReviewForStatusFor(owner, currentReviewStatus);
      if (status) {
        ownerReviewStatuses.push(status);
      }
    }
    const overallStatus = getOverallState(ownerReviewStatuses);
    reviewSummary.set(entry, { files, ownerReviewStatuses, overallStatus });
  }

  return reviewSummary;
}
