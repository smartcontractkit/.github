import { ActionSchema, WorkflowSchema } from "./generated/types/index.mjs";
import { listAllYamlFiles } from "./utils.mjs";
import * as log from "./logger.mjs";
import * as github from "./github.mjs";
import { RunContext } from "./index.mjs";

import { basename, join } from "node:path";
import { readFile } from "node:fs/promises";
import YAML from "yaml";

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

  directDependencies: Action[];

  indirectDependencies?: Action[];
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

  log.debug(`Processing Workflow: ${file}`);

  const fileStr = await readFile(path, "utf-8");
  const parsedFile = YAML.parse(fileStr) as WorkflowSchema;

  if (parsedFile == null) {
    log.warn("Empty file: ", path);
    return { file, path, jobs: [] };
  }

  const { name, jobs: jobDefinitions } = parsedFile;

  if (!jobDefinitions) {
    log.warn("No jobs found in workflow file: ", path);
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
    log.warn(
      "Found Job which is uses a workflow call, to initiate another workflow. This is not directly supported, but if the workflow is in the same repository it will be parsed regularly.",
    );
    return {
      name: jobKey,
      containingWorkflow: workflow,
      directDependencies: [],
    };
  }

  if (!("steps" in jobDefinition)) {
    log.error(
      "No steps found in job definition, bad job definition? Assuming no dependencies",
    );
    return {
      name: jobKey,
      containingWorkflow: workflow,
      directDependencies: [],
    };
  }

  const actionIdentifiers = extractActionIdentifiersFromSteps(
    jobDefinition.steps,
  );

  const referencePath: ReferencePath = [workflow, jobKey];

  const directDependenciesPromises = actionIdentifiers.map((identifier) =>
    parseActionFromIdentifier(ctx, referencePath, identifier),
  );

  const directDependencies = (
    await Promise.all(directDependenciesPromises)
  ).filter((action) => !!action) as Action[];

  const transitiveDependenciesPromise = directDependencies.map((dependency) => {
    const newReferencePath = [...referencePath, dependency.identifier];
    return parseTransitiveDependenciesRecursive(
      ctx,
      newReferencePath,
      dependency,
    );
  });

  const indirectDependencies = (
    await Promise.all(transitiveDependenciesPromise)
  ).flat();

  return {
    name: jobKey,
    containingWorkflow: workflow,
    directDependencies,
    indirectDependencies,
  };
}

/**
 * Recursively parses the transitive dependencies of an action
 * @param ctx the RunContext
 * @param referencePath the reference path to the action, that is the list of actions that led to this action
 * @param action the action to parse the transitive dependencies of
 * @returns a list of actions that are dependencies of the action
 */
async function parseTransitiveDependenciesRecursive(
  ctx: RunContext,
  referencePath: ReferencePath,
  action: Action,
): Promise<Action[]> {
  const transitiveDependenciesPromise = action.dependencies.map((identifier) =>
    parseActionFromIdentifier(ctx, referencePath, identifier),
  );
  const transitiveDependencies = (
    await Promise.all(transitiveDependenciesPromise)
  ).filter((action) => !!action) as Action[];

  const recursiveDependenciesPromise = transitiveDependencies.map(
    async (dependency) => {
      const newReferencePath = [...referencePath, dependency.identifier];
      return parseTransitiveDependenciesRecursive(
        ctx,
        newReferencePath,
        dependency,
      );
    },
  );

  const recursiveDependencies = (
    await Promise.all(recursiveDependenciesPromise)
  ).flat();
  return [...transitiveDependencies, ...recursiveDependencies];
}

/**
 * Parses an action from an identifier, either by reading a local action, fetching the action yaml for an external action, or returning a previously parsed action.
 */
async function parseActionFromIdentifier(
  ctx: RunContext,
  referencePath: ReferencePath,
  identifier: string,
): Promise<Action | undefined> {
  if (ctx.actionsByIdentifier[identifier]) {
    log.debug(
      `Cache hit for action ${identifier}`,
      `(${referencePath.join(" -> ")})`,
    );
    ctx.actionsByIdentifier[identifier].referencePaths.push(referencePath);
    return ctx.actionsByIdentifier[identifier];
  }

  const actionYamlContents = await getActionYamlFromIdentifier(ctx, identifier);
  if (actionYamlContents == null) {
    log.error(`Empty action YAML contents found for ${identifier}. Skipping.`);
    return;
  }

  const action = await parseActionFile(
    identifier,
    referencePath,
    actionYamlContents,
  );

  // Cache the parsed action
  ctx.actionsByIdentifier[action.identifier] = action;

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
    log.error(
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
