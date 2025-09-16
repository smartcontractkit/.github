import * as log from "./logger.mjs";
import { RunContext } from "./index.mjs";

import "zx/globals";
$.verbose = false;

export async function prepareRepository(ctx: RunContext) {
  await performInDir(ctx.repoDir, async () => {
    if (ctx.git.reset) {
      await $`git reset --hard HEAD`;
    }

    const isClean = await isWorkingDirectoryClean();
    if (!isClean) {
      log.error("Repository is not clean");
      process.exit(1);
    }

    if (!ctx.git.branch) {
      log.debug("Skipping branch (no-branch flag set)");
      return;
    }

    const defaultBranch = await getDefaultBranch();
    log.debug(`Default branch: ${defaultBranch}`);

    await $`git fetch --all`;
    await $`git checkout ${defaultBranch}`;
    await $`git pull origin ${defaultBranch}`;
    await $`git checkout -b chore/update-github-actions-${Date.now()}`;
  });
}

async function getDefaultBranch(): Promise<string> {
  const result = (
    await $`git symbolic-ref refs/remotes/origin/HEAD`
  ).stdout.trim();
  return result.substring("refs/remotes/origin/".length);
}

async function isWorkingDirectoryClean(): Promise<boolean> {
  const result = (
    await $`git status --untracked-files=no --porcelain`
  ).stdout.trim();
  return result.length === 0;
}

export async function commit(ctx: RunContext, message: string) {
  if (!ctx.git.commit) {
    log.debug("Skipping commit (no-commit flag set)");
    return;
  }

  await performInDir(ctx.repoDir, async () => {
    log.info(`Committing changes with message: ${message}`);
    log.info("Tap your YubiKey!");
    await $`git add --all`;
    await $`git commit -m ${message}`;
  });
}

async function performInDir<T>(
  repositoryDirectory: string,
  fn: () => Promise<T>,
) {
  const prevDir = (await $`pwd`).stdout.trim();
  cd(repositoryDirectory);

  return await fn().finally(() => {
    cd(prevDir);
  });
}
