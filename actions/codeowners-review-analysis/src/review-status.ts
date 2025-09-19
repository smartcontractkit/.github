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
  actor?: string | null;
  onBehalfOf: string | null;
};

export function getReviewForStatusFor(
  codeowner: string,
  currentReviewStatus: CurrentReviewStatus,
  teamsToMembers: Map<string, string[]>,
): OwnerReviewStatus[] | null {
  if (codeowner.includes("/")) {
    return getReviewStatusForTeam(
      codeowner,
      currentReviewStatus,
      teamsToMembers,
    );
  }

  const userStatus = getReviewStatusForUser(codeowner, currentReviewStatus);
  if (!userStatus) {
    return [
      {
        state: PullRequestReviewStateExt.Pending,
        actor: codeowner,
        onBehalfOf: null,
      },
    ];
  }

  return [userStatus];
}

function getReviewStatusForTeam(
  codeowner: string,
  currentReviewStatus: CurrentReviewStatus,
  teamsToMembers: Map<string, string[]>,
): OwnerReviewStatus[] {
  if (!codeowner.includes("/")) {
    throw new Error(`Codeowner ${codeowner} is not a team`);
  }

  const [_, teamSlug] = codeowner.split("/");

  // Find latest review by this team
  const teamLatest = currentReviewStatus.teamLatest[teamSlug];
  if (teamLatest) {
    return [
      {
        state: toExtended(teamLatest.state),
        actor: teamLatest.byUser,
        onBehalfOf: codeowner,
      },
    ];
  }

  // Not found in teamLatest, check if pending
  const team = currentReviewStatus.pendingTeams.find(
    (t) => t.slug === teamSlug,
  );
  if (team) {
    return [
      {
        state: PullRequestReviewStateExt.Pending,
        actor: null,
        onBehalfOf: codeowner,
      },
    ];
  }

  const reviewStatuses: OwnerReviewStatus[] = [];
  const members = teamsToMembers.get(codeowner);
  if (members && members.length > 0) {
    for (const member of members) {
      const status = getReviewStatusForUser(member, currentReviewStatus);
      if (status) {
        reviewStatuses.push({ ...status, onBehalfOf: codeowner });
      }
    }
  }

  if (reviewStatuses.length > 0) {
    return reviewStatuses;
  }

  core.warning(
    `No status found for teamslug: ${teamSlug} - default to pending`,
  );
  return [
    {
      state: PullRequestReviewStateExt.Pending,
      actor: null,
      onBehalfOf: codeowner,
    },
  ];
}

function getReviewStatusForUser(
  actor: string,
  currentReviewStatus: CurrentReviewStatus,
): OwnerReviewStatus | null {
  const userLatest = currentReviewStatus.userLatest[actor];
  if (userLatest) {
    return {
      state: toExtended(userLatest.state),
      actor: actor,
      onBehalfOf: null,
    };
  }

  // Not found in userLatest, check if pending
  const pendingUser = currentReviewStatus.pendingUsers.find(
    (u) => u.login === actor,
  );
  if (pendingUser) {
    return {
      state: PullRequestReviewStateExt.Pending,
      actor: actor,
      onBehalfOf: null,
    };
  }

  return null;
}
