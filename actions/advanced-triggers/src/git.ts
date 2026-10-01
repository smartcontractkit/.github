import * as core from "@actions/core";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Returns changed files between two git refs using `git diff --name-only`.
 * If either ref cannot be resolved, a shallow `git fetch` of the missing
 * commit(s) from `origin` is attempted and resolution is retried once. If
 * either ref still cannot be resolved after the retry, an error is thrown.
 */
export async function getChangedFilesGit(
  base: string,
  head: string,
  directory: string = process.cwd(),
  token?: string,
): Promise<string[]> {
  core.info(
    `Getting changed files between ${base} and ${head} in ${directory}`,
  );

  let resolvedHead = await resolveCommitish(head, directory);
  let resolvedBase = await resolveCommitish(base, directory);

  if (!resolvedHead || !resolvedBase) {
    const missing = [resolvedBase ? null : base, resolvedHead ? null : head]
      .filter((ref): ref is string => Boolean(ref))
      .join(", ");
    core.warning(
      `Head ("${head}") or Base ("${base}") could not be resolved. Attempting shallow fetch of missing refs (${missing}) from origin...`,
    );
    await gitFetchMissingRefs(base, head, directory, token);
    resolvedHead = resolvedHead || (await resolveCommitish(head, directory));
    resolvedBase = resolvedBase || (await resolveCommitish(base, directory));
  }

  if (!resolvedBase || !resolvedHead) {
    throw new Error(
      `One or both git references could not be resolved: base=${base} (${resolvedBase}), head=${head} (${resolvedHead}).
      Ensure the repository is checked out and the fetch depth is sufficient.`,
    );
  }

  core.info(
    `Using (after fallback logic) - base: ${resolvedBase}, head: ${resolvedHead}`,
  );

  const { stdout: changedFiles } = await execFileAsync(
    "git",
    ["diff", "--name-only", resolvedBase, resolvedHead],
    { cwd: directory },
  );

  return changedFiles.split("\n").filter(Boolean);
}

/**
 * Fetches only the missing refs from origin with a shallow depth. If a token
 * is provided it is supplied via a transient `http.extraheader` git config so
 * the fetch can authenticate against private repositories.
 */
async function gitFetchMissingRefs(
  base: string,
  head: string,
  directory: string,
  token?: string,
): Promise<void> {
  const refs: string[] = [];
  if (!(await resolveCommitish(base, directory))) refs.push(base);
  if (!(await resolveCommitish(head, directory))) refs.push(head);

  if (refs.length === 0) {
    return;
  }

  core.info(`Fetching missing refs from origin: ${refs.join(", ")}`);

  const args = ["fetch", "origin", "--depth=1", "--", ...refs];
  const options: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: directory };

  if (token) {
    const auth = Buffer.from(`x-access-token:${token}`).toString("base64");
    options.env = {
      ...process.env,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.extraheader",
      GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${auth}`,
    };
  }

  try {
    await execFileAsync("git", args, options);
    core.info(`Successfully fetched missing refs from origin`);
  } catch (err) {
    core.error(`Failed to fetch missing refs from origin: ${err}`);
    throw new Error(`Failed to fetch missing refs from origin: ${err}`);
  }
}

/**
 * Resolves a git ref (branch, tag, or SHA) to a full commit SHA, or null if it cannot be resolved.
 */
async function resolveCommitish(
  ref: string,
  directory: string,
): Promise<string | null> {
  if (!ref || /\s/.test(ref) || ref.includes("..")) return null;

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["rev-parse", "-q", "--verify", `${ref}^{commit}`],
      { cwd: directory },
    );
    return stdout.trim();
  } catch {
    return null;
  }
}
