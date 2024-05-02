import { getEnvironmentVariableOrThrow, checkDeprecated } from "./utils.mjs";
import { ActionsByIdentifier, parseWorkflows } from "./workflows.mjs";
import { compileUpdates, performUpdates } from "./updater.mjs";
import * as caches from "./caches.mjs";
import * as log from "./logger.mjs";
import * as git from "./git-cli.mjs";

import { Octokit } from "octokit";
import minimist from "minimist";
import 'dotenv/config';

export interface RunContext {
  repoDir: string;
  debug: boolean;
  skipUpdates: boolean;
  git: {
    branch: boolean;
    commit: boolean;
    reset: boolean;
  };
  actionsByIdentifier: ActionsByIdentifier;
  octokit: Octokit;
  caches: ReturnType<typeof caches.initialize>;
}

function handleArgs() {
  const defaults = {
    debug: false,
    changes: true,
    branch: true,
    commit: true,
    "force-refresh": false,
    "skip-updates": false,
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
    console.log("  --no-branch: Don't branch (local) the repository");
    console.log(
      "  --no-commit: Don't commit changes (local) to the repository",
    );
    console.log("  --reset-repo: Reset the repository before starting");
    console.log("  --debug: Enable verbose logging");
    console.log("  --help: Display this help message");

    process.exit(0);
  }

  if (!args["repo-dir"]) {
    log.error("No repository directory provided");
    process.exit(1);
  }

  if (args["debug"]) {
    log.setDebug();
    log.debug("Verbose logging enabled");
  }

  const accessToken = getEnvironmentVariableOrThrow("GH_ACCESS_TOKEN");
  const forceRefresh = (args["force-refresh"] as boolean) ?? false;

  return {
    repoDir: args["repo-dir"] as string,
    skipUpdates: args["skip-updates"] as boolean,
    debug: args["debug"] as boolean,
    git: {
      branch: args["branch"] as boolean,
      commit: args["commit"] as boolean,
      reset: args["reset-repo"] as boolean,
    },
    octokit: new Octokit({ auth: accessToken }),
    actionsByIdentifier: {},
    caches: caches.initialize(forceRefresh),
  };
}

async function main() {
  const ctx = handleArgs();

  const { octokit, ...logCtx } = ctx;
  log.debug("Context: ", logCtx);

  if (!ctx.skipUpdates) {
    log.section("Preparing repository");
    await git.prepareRepository(ctx);
  }

  log.section("Checking For Deprecated Dependencies");
  const workflowsByName = await parseWorkflows(ctx);
  const deprecatedPaths = checkDeprecated(workflowsByName);
  outputDeprecatedPaths(ctx.skipUpdates, deprecatedPaths);

  log.section("Updating workflows");

  await compileUpdates(ctx, workflowsByName);

  if (Object.entries(ctx.caches.updateTransactions.get()).length === 0) {
    log.info("No updates needed found.");
    process.exit(deprecatedPaths.length > 0 ? 1 : 0);
  }

  await performUpdates(ctx);
  Object.values(ctx.caches).forEach((cache) => cache.save());

  log.info("All workflows updated successfully.");
  log.section("Double Checking For Deprecated Dependencies After Update");

  ctx.actionsByIdentifier = {};
  const postUpdateWorkflowsByName = await parseWorkflows(ctx);
  const postUpdateDeprecatedPaths = checkDeprecated(postUpdateWorkflowsByName);

  outputDeprecatedPaths(true, postUpdateDeprecatedPaths);
}

main();

function outputDeprecatedPaths(shouldExit: boolean, deprecatedPaths: string[]) {
  if (deprecatedPaths.length > 0) {
    log.error(
      "Deprecated dependencies found:\n    " + deprecatedPaths.join("\n    "),
    );
  } else {
    log.info("No deprecated dependencies found.");
  }

  if (shouldExit) {
    process.exit(deprecatedPaths.length > 0 ? 1 : 0);
  }
}
