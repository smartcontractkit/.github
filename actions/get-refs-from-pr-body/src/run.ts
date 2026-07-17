import * as core from "@actions/core";
import * as github from "@actions/github";

import { getInputs, getInvokeContext } from "./run-inputs";
import { REPO_CONFIG, RepoConfig } from "./repo-config";
import { extractRefsFromBody, isFullSha, validateGitRef } from "./refs";
import { getPullRequestBody, OctokitType, resolveRefToSha } from "./github";
import { verifyCommit } from "./sigscanner";

type ProcessResult = { ok: true; sha: string } | { ok: false; failure: string };

export async function run() {
  try {
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    const inputs = getInputs();
    const octokit = github.getOctokit(context.token);
    core.endGroup();

    if (context.eventName !== "pull_request") {
      core.info(
        `Event '${context.eventName}' is not 'pull_request'; skipping PR body extraction and emitting default refs.`,
      );
      setDefaultOutputs();
      return;
    }

    if (context.prNumber === undefined) {
      core.setFailed(
        "pull_request event received but no PR number was found in the payload.",
      );
      return;
    }

    core.startGroup("Fetch PR body");
    const body = await getPullRequestBody(
      octokit,
      context.owner,
      context.repo,
      context.prNumber,
    );
    core.info(`PR body length: ${body.length}`);
    core.endGroup();

    if (!body.trim()) {
      core.info("PR body is empty; emitting default refs for all repos.");
      setDefaultOutputs();
      return;
    }

    const extracted = extractRefsFromBody(body);
    core.info(`Extracted refs: ${JSON.stringify(extracted)}`);

    if (Object.values(extracted).every((ref) => ref === undefined)) {
      core.info(
        "No override refs found in PR body; emitting default refs for all repos.",
      );
      setDefaultOutputs();
      return;
    }

    const outputs: Record<string, string> = {};
    const failures: string[] = [];

    for (const [name, config] of Object.entries(REPO_CONFIG)) {
      const extractedRef = extracted[name];
      if (extractedRef === undefined) {
        core.info(
          `${name}: no override in PR body, using default '${config.defaultRef}' (not resolved or verified)`,
        );
        outputs[name] = config.defaultRef;
        continue;
      }

      core.startGroup(`Process ${name}`);
      const result = await processRepo({
        name,
        config,
        extractedRef,
        octokit,
        sigscannerUrl: inputs.sigscannerUrl,
        sigscannerApiKey: inputs.sigscannerApiKey,
      });
      core.endGroup();

      if (result.ok) {
        outputs[name] = result.sha;
      } else {
        failures.push(result.failure);
      }
    }

    if (failures.length > 0) {
      core.setFailed(
        `Ref verification failed for ${failures.length} repo(s):\n${failures
          .map((f) => `  - ${f}`)
          .join("\n")}`,
      );
      return;
    }

    for (const [name, config] of Object.entries(REPO_CONFIG)) {
      core.setOutput(config.outputKey, outputs[name]);
    }
    core.info(
      `Final refs: ${Object.entries(outputs)
        .map(([n, sha]) => `${n}=${sha}`)
        .join(", ")}`,
    );
  } catch (error) {
    core.endGroup();
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Action failed: ${message}`);
  }
}

interface ProcessRepoArgs {
  name: string;
  config: RepoConfig;
  extractedRef: string;
  octokit: OctokitType;
  sigscannerUrl: string;
  sigscannerApiKey: string;
}

async function processRepo(args: ProcessRepoArgs): Promise<ProcessResult> {
  const { name, config, extractedRef, octokit } = args;
  const target = `${config.owner}/${config.repo}`;

  core.info(`${name}: using ref '${extractedRef}' from PR body`);

  let validated: string;
  try {
    validated = validateGitRef(extractedRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      failure: `${name}: invalid ref '${extractedRef}' — ${message}`,
    };
  }

  let sha: string;
  if (isFullSha(validated)) {
    sha = validated.toLowerCase();
    core.info(`${name}: ref is already a full SHA (${sha})`);
  } else {
    try {
      sha = await resolveRefToSha(
        octokit,
        config.owner,
        config.repo,
        validated,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        failure: `${name}: could not resolve ref '${validated}' — ${message}`,
      };
    }
  }

  core.info(`${name}: verifying ${sha} against SigScanner (${target})`);
  let verification;
  try {
    verification = await verifyCommit({
      url: args.sigscannerUrl,
      apiKey: args.sigscannerApiKey,
      sha,
      repository: target,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      failure: `${name}: SigScanner request failed for ${sha} — ${message}`,
    };
  }

  if (!verification.verified) {
    const snippet = verification.body.slice(0, 200);
    return {
      ok: false,
      failure: `${name}: SigScanner did not verify ${sha} (status ${verification.status}): ${snippet}`,
    };
  }

  core.info(`${name}: verified ${sha}`);
  return { ok: true, sha };
}

function setDefaultOutputs() {
  for (const [, config] of Object.entries(REPO_CONFIG)) {
    core.setOutput(config.outputKey, config.defaultRef);
  }
}
