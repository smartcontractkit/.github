import * as github from "@actions/github";
import { PushEvent, PullRequestEvent } from "@octokit/webhooks-types";

export type EventData =
  | PullRequestEventData
  | PushEventData
  | WorkflowDispatchEventData;

export interface PullRequestEventData {
  eventName: "pull_request";
  base: string;
  head: string;
  prNumber: number;
}

export interface PushEventData {
  eventName: "push";
  base: string;
  head: string;
}

export interface WorkflowDispatchEventData {
  eventName: "workflow_dispatch";
}

/**
 * This determines the relevant event data from the event payload, used to determine the changed files.
 */
export function getEventData(): EventData {
  const { context } = github;

  switch (context.eventName) {
    case "pull_request":
      const { pull_request: prEvent } = context.payload as PullRequestEvent;
      if (!prEvent.number) {
        throw new Error("Pull request number not found in event payload.");
      }
      return {
        eventName: "pull_request",
        base: prEvent.base.sha,
        head: prEvent.head.sha,
        prNumber: prEvent.number,
      };

    case "push":
      const pushEvent = context.payload as PushEvent;
      if (!pushEvent.before || !pushEvent.after) {
        throw new Error("Push event payload missing 'before' or 'after' SHAs.");
      }
      return {
        eventName: "push",
        base: pushEvent.before,
        head: pushEvent.after,
      };

    case "workflow_dispatch":
      return {
        eventName: "workflow_dispatch",
      };

    default:
      throw new Error(`Unsupported event type: ${context.eventName}`);
  }
}
