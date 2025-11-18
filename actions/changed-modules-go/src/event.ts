import * as github from "@actions/github";
import { PushEvent, PullRequestEvent, MergeGroupEvent } from '@octokit/webhooks-types'

export type EventData = PullRequestEventData | PushEventData | MergeGroupEventData | ScheduleEventData;

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

export interface ScheduleEventData {
  eventName: "schedule";
}

export function getEventData(): EventData {
  const { context } = github;

  switch (context.eventName) {
    case "pull_request":
      const prEvent = github.context.payload as PullRequestEvent;
      return {
        eventName: "pull_request",
        prNumber: prEvent.number,
      };
    case "push":
      const pushEvent = github.context.payload as PushEvent;
      return {
        eventName: "push",
        base: pushEvent.before,
        head: pushEvent.after,
      };
    case "merge_group":
      const mgEvent = github.context.payload as MergeGroupEvent;
      return {
        eventName: "merge_group",
        base: mgEvent.merge_group.base_sha,
        head: mgEvent.merge_group.head_sha,
      };
    case "schedule":
      return {
        eventName: "schedule",
      };
    default:
      throw new Error(`Unsupported event type: ${context.eventName}`);
  }
}
