import * as core from "@actions/core";

import { PullRequestReviewState } from "./generated/graphql";

import type { CurrentReviewStatus } from "./github-gql";

// Extends PullRequestReviewState enum to include "Unknown" state
export enum PullRequestReviewStateExt {
  Approved = PullRequestReviewState.Approved,
  ChangesRequested = PullRequestReviewState.ChangesRequested,
  Commented = PullRequestReviewState.Commented,
  Dismissed = PullRequestReviewState.Dismissed,
  Pending = PullRequestReviewState.Pending,
  Unknown = "UNKNOWN",
}

type WithState = { state: PullRequestReviewStateExt };
export function getOverallState<T extends WithState>(
  statuses: readonly T[],
): PullRequestReviewStateExt {
  if (!statuses || statuses.length === 0) {
    return PullRequestReviewStateExt.Pending;
  }

  // Type-safe precedence map: compiler verifies all members are present.
  const precedence = {
    [PullRequestReviewStateExt.ChangesRequested]: 0,
    [PullRequestReviewStateExt.Approved]: 1,
    [PullRequestReviewStateExt.Commented]: 2,
    [PullRequestReviewStateExt.Dismissed]: 3,
    [PullRequestReviewStateExt.Pending]: 4,
    [PullRequestReviewStateExt.Unknown]: 5,
  } as const satisfies Record<PullRequestReviewStateExt, number>;

  return [...statuses]
    .map((s) => s.state)
    .sort((a, b) => precedence[a] - precedence[b])[0];
}

function toExtended(state: PullRequestReviewState): PullRequestReviewStateExt {
  switch (state) {
    case PullRequestReviewState.Approved:
      return PullRequestReviewStateExt.Approved;
    case PullRequestReviewState.ChangesRequested:
      return PullRequestReviewStateExt.ChangesRequested;
    case PullRequestReviewState.Commented:
      return PullRequestReviewStateExt.Commented;
    case PullRequestReviewState.Dismissed:
      return PullRequestReviewStateExt.Dismissed;
    case PullRequestReviewState.Pending:
      return PullRequestReviewStateExt.Pending;
    default:
      core.warning(
        `Unknown PullRequestReviewState: ${state} - mapping to Unknown`,
      );
      return PullRequestReviewStateExt.Unknown;
  }
}

export function iconFor(state: PullRequestReviewStateExt): string {
  switch (state) {
    case PullRequestReviewStateExt.Approved:
      return "✅";
    case PullRequestReviewStateExt.ChangesRequested:
      return "❌";
    case PullRequestReviewStateExt.Commented:
      return "💬";
    case PullRequestReviewStateExt.Dismissed:
      return "🚫";
    case PullRequestReviewStateExt.Pending:
      return "⏳";
    case PullRequestReviewStateExt.Unknown:
      return "❓";
    default:
      core.warning(
        `Unknown ExtendedPullRequestReviewState: ${state} - using ❓ icon`,
      );
      return "❓";
  }
}

export type OwnerReviewStatus = {
  state: PullRequestReviewStateExt;
  actor: string | null;
};

export function getReviewForStatusFor(
  codeowner: string,
  currentReviewStatus: CurrentReviewStatus,
): OwnerReviewStatus | null {
  if (codeowner.includes("/")) {
    // codeowner is a team
    const [_, teamSlug] = codeowner.split("/");

    // Find latest review by this team
    const teamLatest = currentReviewStatus.teamLatest[teamSlug];
    if (teamLatest) {
      return {
        state: toExtended(teamLatest.state),
        actor: teamLatest.byUser,
      };
    }

    // Not found in teamLatest, check if pending
    const team = currentReviewStatus.pendingTeams.find(
      (t) => t.slug === teamSlug,
    );
    if (team) {
      return { state: PullRequestReviewStateExt.Pending, actor: null };
    }

    core.warning(
      `No status found for teamslug: ${teamSlug} - default to pending`,
    );
    return { state: PullRequestReviewStateExt.Pending, actor: null };
  }

  // codeowner is a user
  const userLatest = currentReviewStatus.userLatest[codeowner];
  if (userLatest) {
    return {
      state: toExtended(userLatest.state),
      actor: codeowner,
    };
  }

  // Not found in userLatest, check if pending
  const pendingUser = currentReviewStatus.pendingUsers.find(
    (u) => u.login === codeowner,
  );
  if (pendingUser) {
    return { state: PullRequestReviewStateExt.Pending, actor: codeowner };
  }

  core.warning(`No status found for user: ${codeowner} - default to pending`);
  return { state: PullRequestReviewStateExt.Pending, actor: null };
}
