import * as github from "@actions/github";
import * as core from "@actions/core";
import minimist from "minimist";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import * as semver from "semver";
import { replaceInFile } from "replace-in-file";

interface TagMap {
  [key: string]: string[];
}

interface ActionObj {
  path: string;
  name: string;
  tagBefore: string;
  tagAfter?: string;
}

interface WorkflowMap {
  [key: string]: ActionObj[];
}

interface OctokitResponseListTagsCommit {
  sha: string;
  url: string;
}

interface OctokitResponseListTags {
  name: string;
  commit: OctokitResponseListTagsCommit;
  zipball_url: string;
  tarball_url: string;
  node_id: string;
}

const ACTION_PATH_PREFIX = "smartcontractkit/.github/actions/";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(message: string, data?: any) {
  console.log(message, data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function error(message: string, errorObj?: any) {
  console.error(message, errorObj);
}

function isWorkflowFileName(fileName: string): boolean {
  return fileName.includes(".yml") || fileName.includes(".yaml");
}

async function buildMonorepoTagMap(
  data: OctokitResponseListTags[],
): Promise<TagMap> {
  return data
    .filter((tag) => tag.name.includes("@"))
    .reduce<TagMap>((accumulator, tag) => {
      const [tagName, tagVersion] = tag.name.split("@");
      if (tagName in accumulator) {
        accumulator[tagName].push(tagVersion);
      } else {
        accumulator[tagName] = [tagVersion];
      }
      return accumulator;
    }, {});
}

async function buildWorkflowMap(
  dir: string,
  files: string[],
): Promise<WorkflowMap> {
  const workflowMap: WorkflowMap = {};
  for (const file of files) {
    workflowMap[file] = [];
    const fileContents = await readFile(join(dir, file), "utf8");
    const parsed = parse(fileContents);
    for (const job in parsed.jobs) {
      for (let i = 0; i < parsed.jobs[job].steps.length; i++) {
        if (parsed.jobs[job].steps[i].uses) {
          const [name, t1, t2] = parsed.jobs[job].steps[i].uses.split("@");
          workflowMap[file].push({
            path: `jobs.${job}.steps[${i}]`,
            name,
            tagBefore: t2 ? [t1, t2].join("@") : t1,
          });
        }
      }
    }
  }
  return workflowMap;
}

async function updateActionsInWorkflowMap(
  wm: WorkflowMap,
  tm: TagMap,
): Promise<WorkflowMap> {
  for (const actions of Object.values(wm)) {
    for (const action of actions) {
      if (!action.name.includes(ACTION_PATH_PREFIX)) continue;

      const actionVersion = action.tagBefore.split("@")[1];

      if (semver.valid(actionVersion)) {
        const actionName = action.name.replace(ACTION_PATH_PREFIX, "");
        const sortedVersions = semver.rsort(tm[actionName] || []);
        action.tagAfter = `${actionName}@${sortedVersions[0]}`;
      }
    }
  }

  return wm;
}

async function updateActionsInWorkflowFiles(
  dir: string,
  files: string[],
  wm: WorkflowMap,
) {
  for (const file of files) {
    for (const action of wm[file]) {
      if (!action.tagAfter) continue;

      const options = {
        files: `${dir}/${file}`,
        from: `${action.name}@${action.tagBefore}`,
        to: `${action.name}@${action.tagAfter}`,
      };

      try {
        const results = await replaceInFile(options);
        log("Replacement results:", results);
      } catch (errorObj) {
        error("Error occurred:", errorObj);
      }
    }
  }
}

async function run() {
  const argv = minimist(process.argv.slice(2));
  const { local, tokenEnv, owner, repo, dir } = argv;
  const githubToken = local
    ? process.env[tokenEnv] || ""
    : core.getInput("github-token");
  const githubOwner = local
    ? owner || "smartcontractkit"
    : core.getInput("github-owner");
  const githubRepo = local ? repo || ".github" : core.getInput("github-repo");
  const workflowDir = local
    ? dir || "./.github/workflows"
    : core.getInput("workflow-dir");
  const octokit = github.getOctokit(githubToken);

  // get list of monorepo tags from .github
  const { data: tags } = await octokit.rest.repos.listTags({
    owner: githubOwner,
    repo: githubRepo,
  });

  // build tag map
  const tagMap = await buildMonorepoTagMap(tags);
  log("Tag map:", tagMap);

  // get workflow files
  const workflowFiles = (await readdir(workflowDir)).filter(isWorkflowFileName);
  log("Workflow files:", workflowFiles);

  // build workflow map
  let workflowMap = await buildWorkflowMap(workflowDir, workflowFiles);
  log("Workflow map:", workflowMap);

  // update actions in workflow map w/ latest semver
  workflowMap = await updateActionsInWorkflowMap(workflowMap, tagMap);
  log("Updated Workflow map:", workflowMap);

  // update actions in workflow files w/ latest semver
  await updateActionsInWorkflowFiles(workflowDir, workflowFiles, workflowMap);
}

run();
