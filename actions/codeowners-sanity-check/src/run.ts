import * as core from "@actions/core";

import { getInvokeContext, getInputs } from "./run-inputs";
import {
  checkCodeOwners,
  getSummaryUrl,
  updatePRComment,
  upsertPRComment,
} from "./github";
import {
  generateMarkdownTableVerbose,
  getNoCodeownersMsg,
  getSuccessfulMsg,
  getInvalidMsg,
  annotateErrors,
} from "./strings";

export async function run(): Promise<void> {
  try {
    core.startGroup("Context");
    const context = getInvokeContext();
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);
    const inputs = getInputs();
    core.debug(`Inputs: ${JSON.stringify(inputs)}`);
    core.endGroup();

    const { token, owner, repo, head, prNumber, actor } = context;

    core.startGroup("Check CODEOWNERS");
    const result = await checkCodeOwners(token, owner, repo, head);
    if (result.kind === "success") {
      const commentBody = getSuccessfulMsg(actor);
      await updatePRComment(token, owner, repo, prNumber, commentBody);
    } else if (result.kind === "errors" && result.errors.length > 0) {
      const { errors } = result;
      annotateErrors(errors);
      const summaryUrl = await getSummaryUrl(token, owner, repo);
      const commentBody = getInvalidMsg(actor, errors.length, summaryUrl);
      await upsertPRComment(token, owner, repo, prNumber, commentBody);
      core.summary.addRaw(generateMarkdownTableVerbose(errors)).write();
      if (inputs.enforce) {
        core.setFailed("CODEOWNERS file contains errors.");
      }
    } else if (result.kind === "not_found") {
      const commentBody = getNoCodeownersMsg(actor);
      await upsertPRComment(token, owner, repo, prNumber, commentBody);
      if (inputs.enforce) {
        core.setFailed("No CODEOWNERS file found.");
      }
    } else if (result.kind === "failure") {
      core.error(`Unexpected error: ${result.message}`);
    }
    core.endGroup();
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}
