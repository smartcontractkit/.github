import * as github from "@actions/github";
import {
  PushEvent,
  PullRequestEvent,
  MergeGroupEvent,
} from "@octokit/webhooks-types";

export type EventData =
  | PullRequestEventData
  | PushEventData
  | MergeGroupEventData
  | NoChangeEventData;

export interface PullRequestEventData {
  eventName: "pull_request";
  prNumber: number;
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

export interface NoChangeEventData {
  eventName: "no-change";
}

/**
 * This determines the relevant event data from the event payload, used to determine the changed files.
 */
export function getEventData(): EventData {
  const { context } = github;

  switch (context.eventName) {
    case "pull_request":
      const prEvent = context.payload.pull_request as PullRequestEvent;
      if (!prEvent.number) {
        throw new Error("Pull request number not found in event payload.");
      }
      return {
        eventName: "pull_request",
        prNumber: prEvent.number,
      };
    case "push":
      const pushEvent = github.context.payload as PushEvent;
      if (!pushEvent.before || !pushEvent.after) {
        throw new Error("Push event payload missing 'before' or 'after' SHAs.");
      }
      return {
        eventName: "push",
        base: pushEvent.before,
        head: pushEvent.after,
      };

    case "merge_group":
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
    case "schedule":
    case "workflow_dispatch":
      return {
        eventName: "no-change",
      };
    default:
      throw new Error(`Unsupported event type: ${context.eventName}`);
  }
}
