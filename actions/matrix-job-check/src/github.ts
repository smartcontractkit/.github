import * as core from "@actions/core";
import * as github from "@actions/github";
import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export type OctokitType = ReturnType<typeof github.getOctokit>;

type ListJobsResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["actions"]["listJobsForWorkflowRun"]
>;
export type WorkflowJobs = ListJobsResponse["data"]["jobs"];

export async function getWorkflowJobs(
  octokit: OctokitType,
  owner: string,
  repo: string,
  workflowRunId: string,
): Promise<WorkflowJobs> {
  core.info(
    `Fetching workflow jobs for run ID ${workflowRunId} in ${owner}/${repo}`,
  );

  const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: parseInt(workflowRunId, 10),
    per_page: 100,
  });

  return data.jobs;
}
