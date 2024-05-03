import * as log from "./logger.mjs";
import { RunContext } from "./index.mjs";
import {
  Action,
  WorkflowByName,
  extractDetailsFromActionIdentifier,
} from "./workflows.mjs";

import * as github from "./github.mjs";
import * as git from "./git-cli.mjs";

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getActionYamlPath } from "./utils.mjs";

export interface UpdateTransaction {
  [key: string]: {
    identifiers: string[];
    references: {
      file: string;
      ref: string;
    }[];
    newVersion: {
      sha: string;
      version: string;
    };
  };
}

export async function compileUpdates(
  ctx: RunContext,
  workflowsByName: WorkflowByName,
) {
  const allPromises: ReturnType<typeof processActionDependency>[] = [];

  // iterate over workflows
  for (const workflow of Object.values(workflowsByName)) {
    log.debug(`Workflow: ${workflow.name} - path: ${workflow.path}`);

    for (const job of workflow.jobs) {
      log.debug(`Job: ${job.name}`);

      for (const dependency of job.dependencies) {
        allPromises.push(
          processActionDependency(ctx, dependency, workflow.path),
        );
      }
    }
  }

  return Promise.all(allPromises).then(() => {});
}

async function processActionDependency(
  ctx: RunContext,
  action: Action | undefined,
  filePath: string,
): Promise<void> {
  if (!action) {
    return;
  }

  if (action.identifier.startsWith("./")) {
    log.debug(`Local Action: ${action.identifier}`);
    const actionPath = await getActionYamlPath(
      join(ctx.repoDir, action.identifier),
    );

    if (!actionPath) {
      return;
    }

    const dependenciesPromises = action.dependencies.map((identifier) => {
      const action = ctx.caches.actionsByIdentifier.getValue(identifier);
      if (!action) {
        log.warn(`Action dependency not found: ${identifier} - skipping.`);
        return Promise.resolve();
      }
      return processActionDependency(ctx, action, actionPath);
    });

    return Promise.all(dependenciesPromises).then(() => {});
  }

  const details = extractDetailsFromActionIdentifier(action.identifier);
  if (!details) {
    log.warn(`Unexpected action identifier: ${action.identifier} - skipping.`);
    return;
  }

  const { owner, repo, repoPath, ref } = details;

  log.debug(`Checking ${owner}/${repo}${repoPath}@${ref}`);

  const currentVersion = await github.getVersionFromSHA(
    ctx,
    owner,
    repo,
    repoPath,
    ref,
  );
  const latestVersion = github.getLatestVersion(ctx, owner, repo, repoPath);

  if (!latestVersion) {
    log.debug(`No newest version found for ${owner}/${repo}${repoPath}@${ref}`);
    return;
  }

  if (ref !== latestVersion.sha) {
    log.debug(
      `Outdated dependency: ${owner}/${repo}@${ref} => ${currentVersion} < ${latestVersion.version}`,
    );

    if (currentVersion !== latestVersion.version) {
      log.debug(
        `Saving update ${owner}/${repo}${repoPath} from ${currentVersion} to ${latestVersion.version}`,
      );
      saveUpdateTransaction(
        ctx,
        owner,
        repo,
        filePath,
        ref,
        latestVersion.sha,
        latestVersion.version,
        action.identifier,
        repoPath,
      );
    }
  }
}

function saveUpdateTransaction(
  ctx: RunContext,
  owner: string,
  repo: string,
  filePath: string,
  existingRef: string,
  newRef: string,
  newVersion: string,
  identifier: string,
  innerRepoPath?: string,
) {
  const entry =   ctx.caches.updateTransactions
  .getValueOrDefault(`${owner}/${repo}${innerRepoPath || ""}`, {
    identifiers: [],
    references: [],
    newVersion: {
      sha: newRef,
      version: newVersion,
    },
  });

  entry.references.push({
    file: filePath,
    ref: existingRef,
  });

  entry.identifiers.push(identifier);
}

export async function performUpdates(ctx: RunContext) {
  const updates = Object.entries(ctx.caches.updateTransactions.get());
  const numUpdates = updates.length;
  let updateCounter = 1;

  // sort the updates for easier reading, and squashing if needed
  updates.sort(([a], [b]) => a.localeCompare(b));

  for (const [action, update] of updates) {
    if (update.references.length === 0) {
      log.info(`${updateCounter++}/${numUpdates} - No updates for ${action}`);
      continue;
    }

    log.info(
      `${updateCounter++}/${numUpdates} - Performing update for ${action} to ${
        update.newVersion.sha
      } (${update.newVersion.version})`,
    );

    for (const { file, ref } of update.references) {
      const trimmedFile = file.replace(join(ctx.repoDir,".github"), "");
      log.debug(
        `Updating ${trimmedFile} from ${action}@${ref} to ${action}@${update.newVersion.sha} # ${update.newVersion.version}`,
      );

      const fileStr = await readFile(file, "utf-8");
      const regex = new RegExp(`["']?${action}@${ref}["']?( #.*)?`, "g");
      const newFileStr = fileStr.replaceAll(
        regex,
        `${action}@${update.newVersion.sha} # ${update.newVersion.version}`,
      );
      await writeFile(file, newFileStr, "utf-8");
    }

    const actionName = action
      .replace("smartcontractkit/.github/actions/", "")
      .replace("smartcontractkit/chainlink-github-actions/", "");

    await git.commit(
      ctx,
      `chore: update ${actionName} to ${update.newVersion.version}`,
    );
  }
}
