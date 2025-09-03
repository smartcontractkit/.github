import * as core from "@actions/core";
import * as github from "@actions/github";

import { checkCodeOwners, updatePRComment, upsertPRComment } from "./github";
import {
  getNoCodeownersFoundMessage,
  getSuccessfulCodeownersMessage,
  getInvalidCodeownersMessage,
  annotateErrors,
} from "./strings";

export async function run(): Promise<void> {
  try {
    // 1. Get inputs and context
    core.startGroup("Context");
    const context = getInvokeContext();
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);
    const { token, owner, repo, head, prNumber, actor } = context;
    core.endGroup();

    core.startGroup("Check CODEOWNERS");
    const result = await checkCodeOwners(token, owner, repo, head);
    if (result.kind === "success") {
      await updatePRComment(
        token,
        owner,
        repo,
        prNumber,
        getSuccessfulCodeownersMessage(actor),
      );
    } else if (result.kind === "errors") {
      const { errors } = result;
      annotateErrors(errors);
      await upsertPRComment(
        token,
        owner,
        repo,
        prNumber,
        getInvalidCodeownersMessage(actor, errors),
      );
    } else if (result.kind === "not_found") {
      await upsertPRComment(
        token,
        owner,
        repo,
        prNumber,
        getNoCodeownersFoundMessage(actor),
      );
    } else if (result.kind === "failure") {
      core.error(`Unexpected error: ${result.message}`);
    }
    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Parses the invoke context from Github Actions' context.
 * @returns The invoke context
 */
export function getInvokeContext() {
  const { context } = github;
  const { owner, repo } = github.context.repo;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.setFailed("GitHub token is not set.");
    return process.exit(1);
  }

  const { pull_request } = context.payload;
  if (context.eventName !== "pull_request" || !pull_request) {
    core.setFailed(
      `This action can only be run on pull requests events. Got ${context.eventName}`,
    );
    return process.exit(1);
  }

  const { number: prNumber } = pull_request;
  const { sha: base } = pull_request.base;
  const { sha: head } = pull_request.head;

  if (!base || !head || !prNumber) {
    core.setFailed(
      `Missing required pull request information. Base: ${base}, Head: ${head}, PR: ${prNumber}`,
    );
    return process.exit(1);
  }

  core.info(`Event name: ${context.eventName}`);
  core.info(
    `Owner: ${owner}, Repo: ${repo}, Base: ${base}, Head: ${head}, PR: ${
      prNumber ?? "N/A"
    } Actor: ${context.actor}`,
  );

  return { token, owner, repo, base, head, prNumber, actor: context.actor };
}
