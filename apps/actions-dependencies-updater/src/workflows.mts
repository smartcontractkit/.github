import { ActionSchema, WorkflowSchema } from "./generated/types/index.mjs";
import { listAllYamlFiles } from "./utils.mjs";
import * as log from "./logger.mjs";
import * as github from "./github.mjs";
import { RunContext } from "./index.mjs";

import { basename, join } from "node:path";
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { NormalJob } from "./generated/types/github-workflow.mjs";

/**
 * The return value of the parse workflows method.
 */
export interface WorkflowByName {
  [WorkFlowName: string]: Workflow;
}

/**
 * The map of all parsed actions by their identifier. This is used to prevent duplicate parsing of actions.
 */
export interface ActionsByIdentifier {
  [identifier: ActionIdentifier]: Action;
}

export interface Action {
  name: string;
  identifier: ActionIdentifier;
  referencePaths: ReferencePath[];
  type: ActionSchema["runs"]["using"];
  dependencies: ActionIdentifier[];
}

/**
 * The path of actions to a dependency action, this is a path of actions to reach a specific dependency.
 * The entries in the path include workflow names, job names, and action identifiers. They create the path to the dependency.
 */
export type ReferencePath = string[];

/**
 * The identifier of an action, this is the string used to reference the action in a workflow or composite action.
 * Local actions are referenced by their path relative to the root of the repository, like `./.github/actions/my-action`
 * External actions are referenced by their owner/repo@ref, like `actions/checkout@v2` or `smartcontractkit/.github/actions/ci-lint-ts@main`
 */
type ActionIdentifier = string;

/**
 * The workflow itself.
 */
interface Workflow {
  /**
   * The name of the workflow, as defined in the workflow file. Is not guaranteed to be unique.
   */
  name?: string;
  /**
   * The workflow's filename, this is unique due to filesystem constraints.
   */
  file: string;
  /**
   * The path to the workflow file
   */
  path: string;
  /**
   * The workflow's jobs, and their dependencies as labelled encountered through a job's steps
   */
  jobs: Job[];
}

interface Job {
  name: string;

  containingWorkflow: string;

  dependencies: Action[];
}

/**
 * Parses all workflows in the repository and returns them as a map of workflow name to workflow object.
 * @param ctx the RunContext
 * @returns a map of workflow name to workflow object, containing all workflows in the repository
 */
export async function parseWorkflows(ctx: RunContext) {
  const workflowDirectory = join(ctx.repoDir, ".github", "workflows");
  const workflowFiles = await listAllYamlFiles(workflowDirectory);

  const workflows: WorkflowByName = {};

  for (const workflowFilePath of workflowFiles) {
    const workflow = await parseWorkflow(ctx, workflowFilePath);
    workflows[workflow.file] = workflow;
  }

  return workflows;
}

/**
 * Parses a workflow file and returns the workflow object
 * @param ctx the RunContext
 * @param workflow the name of the workflow
 * @param path the path to the workflow file
 * @returns the parsed workflow
 */
async function parseWorkflow(ctx: RunContext, path: string): Promise<Workflow> {
  const file = basename(path);

  log.debug(`Processing workflow: ${file}`);

  const fileStr = await readFile(path, "utf-8");
  const parsedFile = YAML.parse(fileStr) as WorkflowSchema;

  if (parsedFile == null) {
    log.warn(`Parsed as empty workflow file: ${file}`);
    return { file, path, jobs: [] };
  }

  const { name, jobs: jobDefinitions } = parsedFile;

  if (!jobDefinitions) {
    log.warn(`No jobs found in workflow file: ${file}`);
    return { name, file, path, jobs: [] };
  }

  const jobsPromises = Object.entries(jobDefinitions).map(
    async ([jobKey, jobDefinition]) =>
      parseJob(ctx, file, jobKey, jobDefinition),
  );

  const jobs = await Promise.all(jobsPromises);
  return { name, file, path, jobs };
}

/**
 * Parses a single job definition contained within a workflow.
 * @param ctx the RunContext
 * @param workflow the name of the workflow
 * @param jobKey the key of the job
 * @param jobDefinition the job definition
 * @returns the parsed job
 */
async function parseJob(
  ctx: RunContext,
  workflow: string,
  jobKey: string,
  jobDefinition: WorkflowSchema["jobs"]["key"],
): Promise<Job> {
  log.debug(`Processing Job: ${workflow} - ${jobKey}`);

  if ("uses" in jobDefinition) {
    log.debug("Found workflow call in job definition", jobDefinition.uses);

    const dependencies = await parseWorkflowCall(ctx, workflow, jobKey, jobDefinition.uses);
    return {
      name: jobKey,
      containingWorkflow: workflow,
      dependencies: dependencies ?? [],
    };
  }

  if (!("steps" in jobDefinition)) {
    log.warn(
      "No steps found in job definition, bad job definition? Assuming no dependencies",
    );
    return {
      name: jobKey,
      containingWorkflow: workflow,
      dependencies: [],
    };
  }

  const actionIdentifiers = extractActionIdentifiersFromSteps(
    jobDefinition.steps,
  );

  const referencePath: ReferencePath = [workflow, jobKey];

  const directDependencies = await parseDependenciesRecursive(
    ctx,
    referencePath,
    actionIdentifiers,
  );

  return {
    name: jobKey,
    containingWorkflow: workflow,
    dependencies: directDependencies,
  };
}

/**
 * Recursively parses the transitive dependencies of an action
 * @param ctx the RunContext
 * @param referencePath the reference path to the action, that is the list of actions that led to this action
 * @param action the action to parse the transitive dependencies of
 * @returns a list of actions that are dependencies of the action
 */
async function parseDependenciesRecursive(
  ctx: RunContext,
  referencePath: ReferencePath,
  identifiers: string[],
): Promise<Action[]> {
  const dependenciesPromise = identifiers.map((identifier) =>
    parseActionFromIdentifier(ctx, referencePath, identifier),
  );

  const dependencies = (await Promise.all(dependenciesPromise)).filter(
    (action) => !!action,
  ) as Action[];

  const recursiveDependenciesPromise = dependencies.map(async (action) => {
    const newReferencePath = [...referencePath, action.identifier];
    return parseDependenciesRecursive(
      ctx,
      newReferencePath,
      action.dependencies,
    );
  });

  const recursiveDependencies = (
    await Promise.all(recursiveDependenciesPromise)
  ).flat();
  return [...dependencies, ...recursiveDependencies];
}

/**
 * Parses an action from an identifier, either by reading a local action, fetching the action yaml for an external action, or returning a previously parsed action.
 */
async function parseActionFromIdentifier(
  ctx: RunContext,
  referencePath: ReferencePath,
  identifier: string,
): Promise<Action | undefined> {
  if (ctx.caches.actionsByIdentifier.exists(identifier)) {
    log.debug(
      `Cache hit for action ${identifier}`,
      `(${referencePath.join(" -> ")})`,
    );

    const action = ctx.caches.actionsByIdentifier.getValue(identifier);
    action.referencePaths.push(referencePath);
    return action;
  }

  const actionYamlContents = await getActionYamlFromIdentifier(ctx, identifier);
  if (actionYamlContents == null) {
    log.warn(`Empty action YAML contents found for ${identifier}. Skipping.`);
    return;
  }

  const action = await parseActionFile(
    identifier,
    referencePath,
    actionYamlContents,
  );

  // Cache the parsed action
  ctx.caches.actionsByIdentifier.set(identifier, action);

  return action;
}

/**
 * Given an action identifier, returns the action YAML string. This can be a local action (reads from disk) or an external action (fetches from github).
 */
async function getActionYamlFromIdentifier(
  ctx: RunContext,
  identifier: string,
) {
  log.debug(`Getting action file for ${identifier}`);

  if (identifier.startsWith("docker://")) {
    log.warn(`Found docker action - will not fetch action yaml: ${identifier}`);
    return;
  }

  if (identifier.startsWith("./")) {
    const actionDirectory = join(ctx.repoDir, identifier);
    const yamlActionFiles = await listAllYamlFiles(actionDirectory).then(
      (files) =>
        files.filter(
          (f) => f.endsWith("action.yml") || f.endsWith("action.yaml"),
        ),
    );

    if (yamlActionFiles.length === 0) {
      log.warn(
        "Found invalid reference to local action yaml. No action file found: ",
        actionDirectory,
      );
      return;
    }

    return await readFile(yamlActionFiles[0], "utf-8");
  }

  const actionDetails = extractDetailsFromActionIdentifier(identifier);
  if (!actionDetails) {
    return;
  }

  const { owner, repo, repoPath: innerRepoPath, ref: gitRef } = actionDetails;
  const remoteActionYaml = await github.getActionFile(
    ctx,
    owner,
    repo,
    innerRepoPath,
    gitRef,
  );

  if (remoteActionYaml == null) {
    log.warn(
      `No action found for ${owner}/${repo}${innerRepoPath}@${gitRef}. Skipping.`,
    );
    return;
  }

  return remoteActionYaml;
}

/**
 * Given a string of the action YAML, parses the action and returns the action object.
 */
async function parseActionFile(
  identifier: string,
  referencePath: ReferencePath,
  actionYamlString: string,
): Promise<Action> {
  const action = YAML.parse(actionYamlString) as ActionSchema;

  log.debug(`${identifier} is a ${action.runs.using} action.`);
  if (action.runs.using === "composite") {
    const stepUsages = extractActionIdentifiersFromSteps(action.runs.steps);
    return {
      name: action.name,
      identifier: identifier,
      type: "composite",
      dependencies: stepUsages,
      referencePaths: [referencePath],
    };
  } else if (action.runs.using.startsWith("node")) {
    return {
      name: action.name,
      identifier: identifier,
      type: action.runs.using,
      dependencies: [],
      referencePaths: [referencePath],
    };
  } else {
    return {
      name: action.name,
      identifier: identifier,
      type: "docker",
      dependencies: [],
      referencePaths: [referencePath],
    };
  }
}

/**
 * Extracts the owner, repo, repoPath and ref from an action identifier for an external action
 */
export function extractDetailsFromActionIdentifier(identifier: string) {
  if (identifier.startsWith("docker:") || identifier.startsWith("./")) {
    return;
  }

  const [ownerRepoPath, ref] = identifier.split("@");
  const [owner, repo, ...path] = ownerRepoPath.split("/");
  const repoPath = (path.length > 0 ? "/" : "") + path.join("/");

  return { owner, repo, repoPath, ref };
}

/**
 * Looks through a list of steps and extracts the uses field from each step
 * @param steps The list of steps to extract the uses field from
 * @returns A list of uses fields
 */
function extractActionIdentifiersFromSteps(
  steps?: { uses?: string }[],
): string[] {
  if (!steps) return [];
  return steps
    .filter((s): s is { uses: string } => !!s.uses)
    .map(({ uses }: { uses: string }) => uses);
}

/**
 * An edge-case for parsing jobs which invoke a workflow_call. Which essentially references another workflow file, local or remote.
 */
async function parseWorkflowCall(
  ctx: RunContext,
  containingWorkflow: string,
  containingJob: string,
  workflowIdentifier: string,
) {
  if (workflowIdentifier.startsWith("./.github/workflows")) {
    log.debug(
      "Found workflow_call to a file in the workflows directory. Skipping.",
    );
    return;
  }

  const isLocalWorkflow = workflowIdentifier.startsWith("./");
  const workflowString = await getWorkflowYamlFromIdentifier(ctx, workflowIdentifier);
  if (workflowString == null) {
    log.warn(
      `No contents found for workflow at ${workflowIdentifier}. Skipping.`,
    );
    return;
  }

  const parsedFile = YAML.parse(workflowString) as WorkflowSchema;
  if (parsedFile?.jobs == null) {
    log.warn(`No jobs found for workflow at ${workflowIdentifier}. Skipping.`);
    return;
  }

  const { jobs: jobDefinitions } = parsedFile;

  // only parse NormalJobs here, so we don't recurse further into other workflow_calls
  const allNormalJobs = Object.entries(jobDefinitions)
  .filter(([,jobDefinition]) => "steps" in jobDefinition) as [string, NormalJob][];

  const dependenciesPromises = allNormalJobs.map(([jobKey, jobDefinition]) => {
    // Find dependencies, but filter out actions that would be in a remote workflows
    const uses = extractActionIdentifiersFromSteps(
      jobDefinition.steps,
    ).filter((identifier) => isLocalWorkflow || !identifier.startsWith("./"));

    return parseDependenciesRecursive(
      ctx,
      [containingWorkflow, containingJob, workflowIdentifier, jobKey],
      uses,
    );
  });

  const recursiveDependencies = (
    await Promise.all(dependenciesPromises)
  ).flat();

  return [...recursiveDependencies];
}

async function getWorkflowYamlFromIdentifier(ctx: RunContext, identifier: string) {
  if (identifier.startsWith("./")) {
    log.debug(
      "Found workflow_call to file outside the workflows directory, but local to the repository.",
    );
    const workflowPath = join(ctx.repoDir, identifier);
    return readFile(workflowPath, "utf-8");
  }

  log.debug(
    "Found workflow_call to an external workflow. Will attempt to fetch and parse.",
  );
  const details = extractDetailsFromActionIdentifier(identifier);
  if (!details) return;
  const { owner, repo, repoPath, ref } = details;
  return github.getFile(
    ctx.octokit,
    owner,
    repo,
    repoPath,
    ref,
  );
}
