import * as core from "@actions/core";

import { getInvokeContext, getInputs } from "./run-inputs";
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
    const inputs = getInputs();
    core.debug(`Inputs: ${JSON.stringify(inputs)}`);
    core.endGroup();

    const { token, owner, repo, head, prNumber, actor } = context;

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
      if (inputs.enforce) {
        core.setFailed("CODEOWNERS file contains errors.");
      }
    } else if (result.kind === "not_found") {
      await upsertPRComment(
        token,
        owner,
        repo,
        prNumber,
        getNoCodeownersFoundMessage(actor),
      );
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
