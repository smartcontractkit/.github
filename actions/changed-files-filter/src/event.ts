import * as github from "@actions/github";
import { PushEvent, MergeGroupEvent } from "@octokit/webhooks-types";

export type EventData =
  | PullRequestEventData
  | PushEventData
  | MergeGroupEventData;

export interface PullRequestEventData {
  eventName: "pull_request";
  prNumber: number;
  /** Base branch SHA — used as fallback for git diff if the API is unavailable or truncated. */
  base: string;
  /** Head (PR branch) SHA — used as fallback for git diff if the API is unavailable or truncated. */
  head: string;
}

export interface PushEventData {
  eventName: "push";
  base: string;
  head: string;
}

export interface MergeGroupEventData {
  eventName: "merge_group";
  base: string;
  head: string;
}

/**
 * Parses the relevant event data from the GitHub Actions event payload.
 * Only pull_request, push, and merge_group are supported.
 */
export function getEventData(): EventData {
  const { context } = github;

  switch (context.eventName) {
    case "pull_request": {
      // context.payload.pull_request is the PR object itself, not the event envelope.
      const pr = context.payload.pull_request as {
        number: number;
        base: { sha: string };
        head: { sha: string };
      };
      if (!pr.number) {
        throw new Error("Pull request number not found in event payload.");
      }
      if (!pr.base?.sha || !pr.head?.sha) {
        throw new Error(
          "Pull request event payload missing 'base.sha' or 'head.sha'.",
        );
      }
      return {
        eventName: "pull_request",
        prNumber: pr.number,
        base: pr.base.sha,
        head: pr.head.sha,
      };
    }

    case "push": {
      const pushEvent = github.context.payload as PushEvent;
      if (!pushEvent.before || !pushEvent.after) {
        throw new Error("Push event payload missing 'before' or 'after' SHAs.");
      }
      return {
        eventName: "push",
        base: pushEvent.before,
        head: pushEvent.after,
      };
    }

    case "merge_group": {
      const mgEvent = github.context.payload as MergeGroupEvent;
      if (!mgEvent.merge_group.base_sha || !mgEvent.merge_group.head_sha) {
        throw new Error(
          "Merge group event payload missing 'base_sha' or 'head_sha'.",
        );
      }
      return {
        eventName: "merge_group",
        base: mgEvent.merge_group.base_sha,
        head: mgEvent.merge_group.head_sha,
      };
    }

    default:
      throw new Error(
        `Unsupported event type: "${context.eventName}". This action supports: pull_request, push, merge_group.`,
      );
  }
}
