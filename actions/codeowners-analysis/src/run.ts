import * as github from "@actions/github";
import * as core from "@actions/core";

import { Octokit } from "@octokit/core";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";

import { getInvokeContext, getInputs } from "./run-inputs";
import { getChangedFilesForPR, getSummaryUrl, upsertPRComment } from "./github";
import { getCodeownersRules, processChangedFiles } from "./codeowners";
import { getCurrentReviewStatus } from "./github-gql";
import { PullRequestReviewState } from "./generated/graphql";

import {
  formatPendingReviewsMarkdown,
  formatAllReviewsSummary,
} from "./strings";

import type { CurrentReviewStatus } from "./github-gql";

export type ReviewSummary = {
  fileToOwners: Record<string, string[]>;
  fileToStatus: Record<string, OwnerReviewStatus[]>;
  pendingOwners: Set<string>;
  pendingFiles: Set<string>;
};
export type OwnerReviewStatus = {
  state: PullRequestReviewState;
  user: string | null;
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
    const codeownersFile = getCodeownersRules(inputs.directory);
    core.info(`Found ${codeownersFile.length} CODEOWNERS entries.`);
    if (codeownersFile.length === 0) {
      core.warning(
        "No CODEOWNERS file found, or it is empty. Skipping analysis.",
      );
      return;
    }
    core.endGroup();

    core.startGroup("Analyze file paths and codeowners patterns");
    const { fileToOwners, allOwners } = processChangedFiles(
      filenames,
      codeownersFile,
    );
    core.endGroup();

    core.startGroup("Get currrent state of PR reviews");
    const OctokitWithGQLPagination = Octokit.plugin(paginateGraphQL);
    const octokitGQL = new OctokitWithGQLPagination({ auth: token });
    const currentReviewStatus = await getCurrentReviewStatus(
      octokitGQL,
      owner,
      repo,
      prNumber,
    );
    core.endGroup();

    core.startGroup("Create CODEOWNERS Summary");
    const codeownersSummary = createReviewSummaryObject(
      fileToOwners,
      allOwners,
      currentReviewStatus,
    );
    await formatAllReviewsSummary(codeownersSummary);
    const summaryUrl = await getSummaryUrl(octokit, owner, repo);
    const pendingReviewMarkdown = formatPendingReviewsMarkdown(
      codeownersSummary,
      summaryUrl,
    );
    if (process.env.CL_LOCAL_DEBUG !== "true") {
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
  fileToOwners: Record<string, string[]>,
  allOwners: string[],
  currentReviewStatus: CurrentReviewStatus,
): ReviewSummary {
  const pendingOwners = new Set<string>(allOwners);
  const pendingFiles = new Set<string>(Object.keys(fileToOwners));

  const fileToStatus: Record<string, OwnerReviewStatus[]> = {};
  for (const [file, owners] of Object.entries(fileToOwners)) {
    core.info(`File: ${file} - Owners: ${owners.join(", ")}`);

    const ownerStatuses: OwnerReviewStatus[] = [];
    for (const owner of owners) {
      const status = getReviewForStatusFor(owner, currentReviewStatus);
      if (status) {
        ownerStatuses.push(status);
        if (status.state === PullRequestReviewState.Approved) {
          core.debug(
            `Owner ${owner} (${status.user}) has approved for file ${file}`,
          );
          pendingOwners.delete(owner);
          pendingFiles.delete(file);
        }
      }
    }
    fileToStatus[file] = ownerStatuses;
  }

  core.info(`Total pending owners: ${pendingOwners.size}`);
  core.debug(`Pending owners: ${Array.from(pendingOwners).join(", ")}`);
  core.info(`Total pending files: ${pendingFiles.size}`);
  core.debug(`Pending files: ${Array.from(pendingFiles).join(", ")}`);

  return { fileToStatus, pendingOwners, pendingFiles, fileToOwners };
}

function getReviewForStatusFor(
  codeowner: string,
  currentReviewStatus: CurrentReviewStatus,
): OwnerReviewStatus | null {
  if (codeowner.includes("/")) {
    const [_, teamSlug] = codeowner.split("/");

    if (currentReviewStatus.teamLatest[teamSlug]) {
      return {
        state: currentReviewStatus.teamLatest[teamSlug].state,
        user: currentReviewStatus.teamLatest[teamSlug].byUser,
      };
    }

    const team = currentReviewStatus.pendingTeams.find(
      (t) => t.slug === teamSlug,
    );
    if (!team) {
      core.warning(`No status found for teamslug: ${teamSlug}`);
      return null;
    }
    return { state: PullRequestReviewState.Pending, user: null };
  }

  if (currentReviewStatus.userLatest[codeowner]) {
    return {
      state: currentReviewStatus.userLatest[codeowner].state,
      user: codeowner,
    };
  }

  const pendingUser = currentReviewStatus.pendingUsers.find(
    (u) => u.login === codeowner,
  );

  if (!pendingUser) {
    core.warning(`No status found for user: ${codeowner}`);
    return null;
  }

  return { state: PullRequestReviewState.Pending, user: codeowner };
}
