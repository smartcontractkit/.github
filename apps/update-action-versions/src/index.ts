import * as github from "@actions/github";
import * as core from "@actions/core";
import minimist from "minimist";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, parseDocument } from "yaml";
import * as semver from "semver";
import { replaceInFile } from "replace-in-file";

interface Scalar {
  comment?: string;
}

interface ActionMapItem {
  version: string;
  shasum: string;
}

interface ActionMap {
  [key: string]: ActionMapItem[];
}

interface ActionObj {
  path: string;
  name: string;
  refBefore: string;
  refAfter?: string;
  commentBefore?: string;
  commentAfter?: string;
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

async function buildMonorepoActionMap(
  data: OctokitResponseListTags[],
): Promise<ActionMap> {
  return data
    .filter((tag) => tag.name.includes("@"))
    .reduce<ActionMap>((accumulator, tag) => {
      const [tagName, tagVersion] = tag.name.split("@");
      if (tagName in accumulator) {
        accumulator[tagName].push({
          version: tagVersion,
          shasum: tag.commit.sha,
        });
      } else {
        accumulator[tagName] = [
          {
            version: tagVersion,
            shasum: tag.commit.sha,
          },
        ];
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
    const parsedDoc = parseDocument(fileContents);
    for (const job in parsed.jobs) {
      for (let i = 0; i < parsed.jobs[job].steps.length; i++) {
        if (parsed.jobs[job].steps[i].uses) {
          const [name, ref] = parsed.jobs[job].steps[i].uses.split("@");
          const usesScalar = parsedDoc.getIn(
            ["jobs", job, "steps", i, "uses"],
            true,
          ) as Scalar;
          const actionObj: ActionObj = {
            path: `jobs.${job}.steps[${i}]`,
            name,
            refBefore: ref,
          };
          if (usesScalar.comment) {
            actionObj.commentBefore = usesScalar.comment.replace(" ", "");
          }
          workflowMap[file].push(actionObj);
        }
      }
    }
  }
  return workflowMap;
}

async function updateActionsInWorkflowMap(
  wm: WorkflowMap,
  am: ActionMap,
): Promise<WorkflowMap> {
  for (const actions of Object.values(wm)) {
    for (const action of actions) {
      if (!action.name.includes(ACTION_PATH_PREFIX)) continue;
      if (!action.commentBefore) continue;
      if (action.commentBefore?.split("@").length !== 2) continue;
      const actionVersion = action.commentBefore?.split("@")[1];
      if (semver.valid(actionVersion)) {
        const actionName = action.name.replace(ACTION_PATH_PREFIX, "");
        const versions = am[actionName].map((x) => x.version);
        const sortedVersions = semver.rsort(versions || []);
        action.refAfter = am[actionName].reduce(
          (acc, curr) =>
            curr.version === sortedVersions[0] ? curr.shasum : acc,
          "",
        );
        action.commentAfter = `${actionName}@${sortedVersions[0]}`;
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
      if (!action.refAfter) continue;
      if (!action.commentAfter) continue;

      const options = {
        files: `${dir}/${file}`,
        from: `${action.name}@${action.refBefore} # ${action.commentBefore}`,
        to: `${action.name}@${action.refAfter} # ${action.commentAfter}`,
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

  // get list of monorepo tags from .github. Have to paginate if greater than 30 entries.
  const tags = await octokit.paginate(octokit.rest.repos.listTags, {
    owner: githubOwner,
    repo: githubRepo,
  });

  console.log(`Number of tags found: ${tags.length}.`)
  console.log(tags.map((x) => x.name));

  // build action map
  const actionMap = await buildMonorepoActionMap(tags);
  log("Action map:", actionMap);

  // get workflow files
  const workflowFiles = (await readdir(workflowDir)).filter(isWorkflowFileName);
  log("Workflow files:", workflowFiles);

  // build workflow map
  let workflowMap = await buildWorkflowMap(workflowDir, workflowFiles);
  log("Workflow map:", workflowMap);

  // update actions in workflow map w/ latest semver
  workflowMap = await updateActionsInWorkflowMap(workflowMap, actionMap);
  log("Updated Workflow map:", workflowMap);

  // update actions in workflow files w/ latest semver
  await updateActionsInWorkflowFiles(workflowDir, workflowFiles, workflowMap);
}

run();
