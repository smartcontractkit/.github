import * as github from "@actions/github";
import * as core from "@actions/core";

import { Octokit } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";

import { getInvokeContext, getInputs } from "./run-inputs";
import {
  getChangedFilesForPR,
  getCodeownersFile,
  getSummaryUrl,
  getTeamToMembersMapping,
  upsertPRComment,
} from "./github";
import {
  getCodeownersEntries,
  processChangedFiles as processChangedFiles,
} from "./codeowners";
import { getCurrentReviewStatusGQL } from "./github-gql";
import {
  formatPendingReviewsMarkdown,
  formatAllReviewsSummaryByEntry,
} from "./strings";
import {
  PullRequestReviewStateExt,
  getOverallState,
  getReviewForStatusFor,
} from "./review-status";

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
    const { allCodeOwners, codeOwnersEntryToFiles } = processChangedFiles(
      filenames,
      codeownersEntries,
    );
    if (allCodeOwners.size === 0) {
      core.warning(
        "No code owners identified for changed files. Skipping analysis.",
      );
      return;
    }
    core.endGroup();

    core.startGroup("Get currrent state of PR reviews");

    const OctokitWithGQLPagination = Octokit.plugin(paginateGraphQL);
    const octokitGQL = new OctokitWithGQLPagination({ auth: token });
    const currentPRReviewState = await getCurrentReviewStatusGQL(
      octokitGQL,
      owner,
      repo,
      prNumber,
    );
    core.debug(`Current PR review state:`);
    core.debug(JSON.stringify(currentPRReviewState));

    const allTeamCodeOwners = Array.from(allCodeOwners).filter((o) =>
      o.includes("/"),
    );
    core.debug(`All codeowners: ${JSON.stringify(allCodeOwners)}`);
    core.debug(`All team code owners: ${JSON.stringify(allTeamCodeOwners)}`);
    const octokitMembers = github.getOctokit(inputs.membersReadGitHubToken);
    const teamsToMembers = await getTeamToMembersMapping(
      octokitMembers,
      owner,
      Array.from(allTeamCodeOwners),
    );
    core.debug(`Teams to members mapping:`);
    core.debug(`${JSON.stringify([...teamsToMembers])}`);

    core.endGroup();

    core.startGroup("Create CODEOWNERS Summary");

    const codeownersSummary = createReviewSummaryObject(
      currentPRReviewState,
      codeOwnersEntryToFiles,
      teamsToMembers,
    );
    core.debug("CODEOWNERS Summary:");
    core.debug(`${JSON.stringify([...codeownersSummary])}`);

    await formatAllReviewsSummaryByEntry(codeownersSummary);
    const summaryUrl = await getSummaryUrl(octokit, owner, repo);
    const pendingReviewMarkdown = formatPendingReviewsMarkdown(
      codeownersSummary,
      summaryUrl,
    );
    console.log(pendingReviewMarkdown);
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
  teamsToMembers: Map<string, string[]>,
): Map<CodeownersEntry, ProcessedCodeOwnersEntry> {
  const reviewSummary: Map<CodeownersEntry, ProcessedCodeOwnersEntry> =
    new Map();
  for (const [entry, files] of codeOwnersEntryToFiles.entries()) {
    const ownerReviewStatuses: OwnerReviewStatus[] = [];
    for (const owner of entry.owners) {
      const statuses = getReviewForStatusFor(
        owner,
        currentReviewStatus,
        teamsToMembers,
      );
      if (statuses) {
        ownerReviewStatuses.push(...statuses);
      }
    }

    const overallStatus = getOverallState(ownerReviewStatuses);
    reviewSummary.set(entry, { files, ownerReviewStatuses, overallStatus });
  }

  return reviewSummary;
}
