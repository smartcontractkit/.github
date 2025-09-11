import {
  getEnvironmentVariableOrExit,
  compileDeprecatedPaths,
  validateRepositoryOrExit,
  isShaRefIdentifier,
} from "./utils.mjs";
import { parseWorkflows } from "./workflows.mjs";
import { compileUpdates, executeUpdates } from "./updater.mjs";
import * as caches from "./caches.mjs";
import * as log from "./logger.mjs";
import * as git from "./git-cli.mjs";

import { Octokit } from "octokit";
import minimist from "minimist";
import "dotenv/config";

export interface RunContext {
  repoDir: string;
  performChecks: boolean;
  performUpdates: boolean;
  git: {
    branch: boolean;
    commit: boolean;
    reset: boolean;
  };
  octokit: Octokit;
  debug: {
    workflows: number;
    actions: number;
    contentRequests: number;
    tagRequests: number;
  };
  caches: ReturnType<typeof caches.initialize>;
}

function handleArgs(): RunContext {
  const defaults = {
    debug: false,
    changes: true,
    branch: true,
    commit: true,
    "force-refresh": false,
    "skip-updates": false,
    "skip-checks": false,
  };
  const args = minimist(process.argv.slice(2), { default: defaults });

  if (args["help"]) {
    console.log("Usage: actions-dependencies-updater");
    console.log("Mandatory arguments:");
    console.log(
      "  --repo-dir <dir>: The directory of the repository to update",
    );
    console.log("Optional Flags:");
    console.log(
      "  --force-refresh: Force a refresh of the github actions version cache",
    );
    console.log(
      "  --skip-updates: Check for deprecated dependencies (node12/node16) but don't update them.",
    );
    console.log(
      "  --skip-checks: Skip checks for deprecated dependencies, only update dependencies to latest.",
    );
    console.log("  --no-branch: Don't branch (local) the repository");
    console.log(
      "  --no-commit: Don't commit changes (local) to the repository",
    );
    console.log("  --reset-repo: Reset the repository before starting");
    console.log("  --debug: Enable verbose logging");
    console.log("  --help: Display this help message");

    process.exit(0);
  }

  if (args["debug"]) {
    log.setDebug();
    log.debug("Verbose logging enabled");
  }

  const repoDir = args["repo-dir"] as string;
  validateRepositoryOrExit(repoDir);
  const accessToken = getEnvironmentVariableOrExit("GH_ACCESS_TOKEN");
  const forceRefresh = (args["force-refresh"] as boolean) ?? false;

  return {
    repoDir,
    performChecks: !args["skip-checks"] as boolean,
    performUpdates: !args["skip-updates"] as boolean,
    debug: {
      workflows: 0,
      actions: 0,
      contentRequests: 0,
      tagRequests: 0,
    },
    git: {
      branch: args["branch"] as boolean,
      commit: args["commit"] as boolean,
      reset: args["reset-repo"] as boolean,
    },
    octokit: new Octokit({ auth: accessToken }),
    caches: caches.initialize(forceRefresh),
  };
}

async function main() {
  log.section("Starting actions-dependencies-updater");
  const ctx = handleArgs();
  const { octokit, ...logCtx } = ctx;
  log.debug("Context: ", logCtx);

  const { performChecks, performUpdates } = ctx;
  if (!performChecks && !performUpdates) {
    exit(ctx, 0);
  }

  if (performUpdates) {
    log.section("Preparing repository");
    await git.prepareRepository(ctx);
  }

  log.section("Parsing workflows");
  const workflowsByName = await parseWorkflows(ctx);

  if (performChecks) {
    log.section("Checking For Deprecated Dependencies");
    const deprecatedPaths = compileDeprecatedPaths(workflowsByName);
    outputDeprecatedPaths(ctx, !performUpdates, deprecatedPaths);
  }

  if (performUpdates) {
    log.section("Updating workflows");
    await compileUpdates(ctx, workflowsByName);
    await executeUpdates(ctx);
  }

  if (performChecks) {
    log.section("Double Checking For Deprecated Dependencies After Update");
    caches.cleanup(ctx.caches);
    const postUpdateWorkflowsByName = await parseWorkflows(ctx);
    const postUpdateDeprecatedPaths = compileDeprecatedPaths(
      postUpdateWorkflowsByName,
    );
    outputDeprecatedPaths(ctx, true, postUpdateDeprecatedPaths);
  }

  exit(ctx, 0);
}

function outputDeprecatedPaths(
  ctx: RunContext,
  shouldExit: boolean,
  deprecatedPaths: string[],
) {
  if (deprecatedPaths.length > 0) {
    log.error(`Deprecated dependencies found (${deprecatedPaths.length})!!`);
    log.output(deprecatedPaths.join("\n"));
  } else {
    log.info("No deprecated dependencies found.");
  }

  if (shouldExit) {
    exit(ctx, deprecatedPaths.length > 0 ? 1 : 0);
  }
}

function exit(ctx: RunContext, code: number) {
  log.debug(ctx.debug);
  caches.persistAll(ctx.caches);
  process.exit(code);
}

main();
