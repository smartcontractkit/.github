import { readFile } from "fs/promises";
import * as core from "@actions/core";
import * as jira from "jira.js";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { isAxiosError } from "axios";
import { formatAxiosError } from "./axios";

export const EMPTY_PREFIX = "";
export const PR_PREFIX = "PR issue: ";
export const SOLIDITY_REVIEW_PREFIX = "Solidity Review issue: ";

export async function doesIssueExist(
  client: jira.Version3Client,
  issueNumber: string,
  dryRun: boolean,
) {
  const payload = {
    issueIdOrKey: issueNumber,
  };

  if (dryRun) {
    core.info("Dry run enabled, skipping JIRA issue enforcement");
    return true;
  }

  try {
    /**
     * The issue is identified by its ID or key, however, if the identifier doesn't match an issue, a case-insensitive search and check for moved issues is performed.
     * If a matching issue is found its details are returned, a 302 or other redirect is not returned. The issue key returned in the response is the key of the issue found.
     */
    const issue = await client.issues.getIssue(payload);
    core.debug(
      `JIRA issue id:${issue.id} key: ${issue.key} found while querying for ${issueNumber}`,
    );
    if (issue.key !== issueNumber) {
      core.error(
        `JIRA issue key ${issueNumber} not found, but found issue key ${issue.key} instead. This can happen if the identifier doesn't match an issue, in which case a case-insensitive search and check for moved issues is performed. Make sure the issue key is correct.`,
      );
      return false;
    }

    return true;
  } catch (e) {
    handleError(e);
    return false;
  }
}

export function generateJiraIssuesLink(baseUrl: string, label: string) {
  // https://smartcontract-it.atlassian.net/issues/?jql=labels%20%3D%20%22review-artifacts-automation-base%3A8d818ea265ff08887e61ace4f83364a3ee149ef0-head%3A3c45b71f3610de28f429cef0163936eaa448e63c%22
  const jqlQuery = `labels = "${label}"`;
  const fullUrl = new URL(baseUrl);
  fullUrl.searchParams.set("jql", jqlQuery);

  const urlStr = fullUrl.toString();
  core.info(`Jira issues link: ${urlStr}`);
  return urlStr;
}

export function generateIssueLabel(
  product: string,
  baseRef: string,
  headRef: string,
) {
  return `review-artifacts-${product}-base:${baseRef}-head:${headRef}`;
}

export async function getGitTopLevel(): Promise<string> {
  const gitTopLevelEnv = process.env.GIT_TOP_LEVEL_DIR;
  if (gitTopLevelEnv) {
    core.debug(
      `GIT_TOP_LEVEL_DIR env var was set tu ${gitTopLevelEnv}. Will use it.`,
    );
    return gitTopLevelEnv;
  }

  const execPromise = promisify(exec);
  try {
    const { stdout, stderr } = await execPromise(
      "git rev-parse --show-toplevel",
    );

    if (stderr) {
      const msg = `Error in command output: ${stderr}`;
      core.error(msg);
      throw Error(msg);
    }

    const topLevelDir = stdout.trim();
    core.info(`Top-level directory: ${topLevelDir}`);
    return topLevelDir;
  } catch (error) {
    const msg = `Error executing command: ${(error as any).message}`;
    core.error(msg);
    throw Error(msg);
  }
}

/**
 * Given a list of strings, this function will return the first JIRA issue number it finds.
 *
 * @example parseIssueNumberFrom("", "CORE-123", "CORE-456", "CORE-789") => "CORE-123"
 * @example parseIssueNumberFrom("", "2f3df5gf", "chore/test-RE-78-branch", "RE-78 Create new test branches") => "RE-78"
 * @example parseIssueNumberFrom("PR: ", "2f3df5gf", "chore/test-RE-78-branch", "PR: RE-78 Create new test branches") => "RE-78"
 */
export function parseIssueNumberFrom(
  prefix: string,
  ...inputs: (string | undefined)[]
): string | undefined {
  function parse(str?: string) {
    prefix = prefix.toUpperCase();
    const jiraIssueRegex = new RegExp(`${prefix}([A-Z]{2,}-\\d+)`);

    const match = str?.toUpperCase().match(jiraIssueRegex);
    return match ? match[1] : undefined;
  }

  core.debug(`Parsing issue number from: ${inputs.join(", ")}`);
  const parsed: string[] = inputs.map(parse).filter((x) => x !== undefined);
  core.debug(`Found issue number: ${parsed[0]}`);

  return parsed[0];
}

export async function extractJiraIssueNumbersFrom(
  prefix: string,
  filePaths: string[],
) {
  const issueNumbers: string[] = [];
  const gitTopLevel = await getGitTopLevel();

  for (const path of filePaths) {
    const fullPath = join(gitTopLevel, path);
    core.info(`Reading file: ${fullPath}`);
    const content = await readFile(fullPath, "utf-8");
    const issueNumber = parseIssueNumberFrom(prefix, content);
    core.info(`Extracted issue number: ${issueNumber}`);
    if (issueNumber) {
      issueNumbers.push(issueNumber);
    }
  }

  return issueNumbers;
}

/**
 * Converts an array of tags to an array of labels.
 *
 * A label is a string that is formatted as `core-release/{tag}`, with the leading `v` removed from the tag.
 *
 * @example tagsToLabels(["v1.0.0", "v1.1.0"]) => [{ add: "core-release/1.0.0" }, { add: "core-release/1.1.0" }]
 */
export function tagsToLabels(tags: string[]) {
  const labelPrefix = "core-release";

  return tags.map((t) => ({
    add: `${labelPrefix}/${t.substring(1)}`,
  }));
}

export function getJiraEnvVars() {
  const jiraHost = process.env.JIRA_HOST;
  const jiraUserName = process.env.JIRA_USERNAME;
  const jiraApiToken = process.env.JIRA_API_TOKEN;

  if (!jiraHost || !jiraUserName || !jiraApiToken) {
    core.setFailed(
      "Error: Missing required environment variables: JIRA_HOST and JIRA_USERNAME and JIRA_API_TOKEN.",
    );
    process.exit(1);
  }

  return { jiraHost, jiraUserName, jiraApiToken };
}

export function createJiraClient() {
  const { jiraHost, jiraUserName, jiraApiToken } = getJiraEnvVars();
  return new jira.Version3Client({
    host: jiraHost,
    authentication: {
      basic: {
        email: jiraUserName,
        apiToken: jiraApiToken,
      },
    },
  });
}

export function handleError(e: unknown) {
  if (e instanceof Error) {
    if (isAxiosError(e)) {
      core.error(formatAxiosError(e));
    } else if (isAxiosError(e.cause)) {
      core.error(formatAxiosError(e.cause));
    } else {
      core.error(e);
    }
  } else {
    core.error(JSON.stringify(e));
  }
  core.setFailed("Error adding traceability to Jira issues");
}
