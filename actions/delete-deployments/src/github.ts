import * as core from "@actions/core";
import * as github from "@actions/github";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

import { GetResponseTypeFromEndpointMethod } from "@octokit/types";

export type OctokitType = ReturnType<typeof github.getOctokit>;

export function getOctokit(token: string) {
  type ThrottlingOptions = Parameters<typeof throttling>[1];
  interface IRequestRateLimitOptions {
    method: string;
    url: string;
  }

  const options: ThrottlingOptions = {
    throttle: {
      onRateLimit: (
        retryAfter,
        options: IRequestRateLimitOptions,
        octokit,
        retryCount,
      ) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`,
        );

        if (retryCount < 1) {
          // only retries once
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (
        _,
        options: IRequestRateLimitOptions,
        octokit,
        retryCount,
      ) => {
        // does not retry, only logs a warning
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url} (retry count: ${retryCount})`,
        );
      },
    },
  };

  return github.getOctokit(token, options, throttling, retry) as OctokitType;
}

export type ListDeploymentsResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["repos"]["listDeployments"]
>["data"];

export type PaginateOptions = {
  numOfPages: number | "all";
  startingPage?: number;
};

export async function listDeployments(
  octokit: OctokitType,
  owner: string,
  repo: string,
  environment: string,
  paginateOptions: PaginateOptions,
  ref?: string,
): Promise<ListDeploymentsResponse> {
  core.info(
    `Listing deployments for environment ${environment} and ref ${ref} in repository ${owner}/${repo}`,
  );
  const listDeploymentsSharedArgs: Parameters<
    typeof octokit.rest.repos.listDeployments
  >[0] = {
    owner,
    repo,
    environment,
    ref,
    per_page: 100,
    request: {
      retries: 20,
    },
  };

  if (paginateOptions.numOfPages === "all") {
    core.info(`Fetching all deployments`);
    const response = await octokit.paginate(
      octokit.rest.repos.listDeployments,
      {
        ...listDeploymentsSharedArgs,
      },
    );

    return response;
  } else {
    core.info(
      `Fetching ${
        paginateOptions.numOfPages * listDeploymentsSharedArgs.per_page!
      } deployments`,
    );
    const deployments: Awaited<
      ReturnType<typeof octokit.rest.repos.listDeployments>
    >["data"] = [];

    const offset = paginateOptions.startingPage || 0;
    for (let i = offset; i < paginateOptions.numOfPages + offset; i++) {
      const deploymentPage = await octokit.rest.repos.listDeployments({
        ...listDeploymentsSharedArgs,
        page: i,
      });

      deployments.push(...deploymentPage.data);
    }

    return deployments;
  }
}

export type CreateDeploymentStatusResponse = GetResponseTypeFromEndpointMethod<
  OctokitType["rest"]["repos"]["createDeploymentStatus"]
>["data"];

export async function createDeploymentStatus(
  octokit: OctokitType,
  owner: string,
  repo: string,
  deploymentId: number,
): Promise<CreateDeploymentStatusResponse | void> {
  core.info(
    `Setting deployment status to 'inactive' for deployment with id ${deploymentId}`,
  );
  try {
    const response = await octokit.rest.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state: "inactive",
      request: {
        retries: 0,
      },
    });

    return response.data;
  } catch (error) {
    core.error(
      `Failed to set deployment status to 'inactive' for deployment with id ${deploymentId} (continuing): ${error}`,
    );
  }
}

export async function deleteDeployment(
  octokit: OctokitType,
  owner: string,
  repo: string,
  deploymentId: number,
): Promise<boolean | void> {
  core.info(`Deleting deployment with id ${deploymentId}`);
  try {
    await octokit.rest.repos.deleteDeployment({
      owner,
      repo,
      deployment_id: deploymentId,
      request: {
        retries: 0,
      },
    });

    return true;
  } catch (error) {
    core.error(`Failed to delete deployment with id ${deploymentId}: ${error}`);
  }
}
