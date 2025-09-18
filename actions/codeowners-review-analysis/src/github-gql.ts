import * as core from "@actions/core";
import { Octokit } from "@octokit/core";

import {
  Repository,
  RateLimit,
  PullRequestReviewState,
  PullRequestReviewDecision,
  Maybe,
  Team,
  PullRequest,
} from "./generated/graphql";

type PullRequestReviewDecisionOrUnknown = PullRequestReviewDecision | "UNKNOWN";

type PendingUsers = { login: string; asCodeOwner: boolean }[];
type PendingTeams = { slug: string; id: string; asCodeOwner: boolean }[];

export type CurrentReviewStatus = {
  reviewDecision: Maybe<PullRequestReviewDecisionOrUnknown>;
  pendingUsers: PendingUsers;
  pendingTeams: PendingTeams;
  userLatest: Record<
    string,
    {
      state: PullRequestReviewState;
      submittedAt: string | null;
      onBehalfOf: Array<{ id: string; slug: string; name: string }>;
      url: string;
    }
  >;
  teamLatest: Record<
    string,
    {
      state: PullRequestReviewState;
      submittedAt: string | null;
      byUser: string | null;
      url: string;
    }
  >;
};

// ----- GraphQL -----

const QUERY = /* GraphQL */ `
  query PRGateBackward(
    $owner: String!
    $name: String!
    $number: Int!
    $last: Int!
    $before: String
  ) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewDecision
        reviewRequests(first: 100) {
          nodes {
            asCodeOwner
            requestedReviewer {
              __typename
              ... on User {
                login
                id
              }
              ... on Team {
                slug
                id
              }
            }
          }
        }
        reviews(last: $last, before: $before) {
          nodes {
            id
            url
            state
            submittedAt
            author {
              __typename
              ... on User {
                login
              }
              ... on Bot {
                login
              }
            }
            onBehalfOf(first: 100) {
              nodes {
                id
                slug
                name
              }
            }
          }
          pageInfo {
            hasPreviousPage
            startCursor
          }
        }
      }
    }
    rateLimit {
      cost
      remaining
      resetAt
    }
  }
`;

async function fetchPage(
  octokit: Octokit,
  owner: string,
  name: string,
  prNumber: number,
  last: number,
  before: string | null,
): Promise<{
  pr: NonNullable<Repository["pullRequest"]>;
  rateLimit?: RateLimit;
}> {
  type GQLResponse = {
    repository: Maybe<Repository>;
    rateLimit: Maybe<RateLimit>;
  };

  const resp = (await octokit.graphql<GQLResponse>(QUERY, {
    owner,
    name,
    number: prNumber,
    last,
    before,
  })) as GQLResponse;
  const pr = resp.repository?.pullRequest;
  if (!pr) throw new Error("PR not found");
  return { pr, rateLimit: resp.rateLimit ?? undefined };
}

function extractPending(pr: NonNullable<Repository["pullRequest"]>): {
  pendingUsers: PendingUsers;
  pendingTeams: PendingTeams;
  decision: PullRequestReviewDecisionOrUnknown;
} {
  const decision: PullRequestReviewDecisionOrUnknown =
    pr.reviewDecision ?? "UNKNOWN";

  const pendingUsers: PendingUsers = [];
  const pendingTeams: PendingTeams = [];

  const rrNodes = pr.reviewRequests?.nodes ?? [];
  if (rrNodes.length === 0) {
    core.debug("No review requests found on the PR.");
  }

  for (const rr of rrNodes) {
    const r = rr?.requestedReviewer;
    if (!r) continue;
    if (r.__typename === "User") {
      core.debug(`Found requested user review: ${r.login}`);
      pendingUsers.push({
        login: r.login,
        asCodeOwner: rr.asCodeOwner,
      });
    } else if (r.__typename === "Team") {
      core.debug(`Found requested team review: ${r.slug}`);
      pendingTeams.push({
        slug: r.slug,
        id: r.id,
        asCodeOwner: rr.asCodeOwner,
      });
    }
  }

  return { pendingUsers, pendingTeams, decision };
}

type UserLatest = CurrentReviewStatus["userLatest"];
type TeamLatest = CurrentReviewStatus["teamLatest"];

function accumulateLatestSignals(
  pr: NonNullable<Repository["pullRequest"]>,
  userLatest: UserLatest,
  teamLatest: TeamLatest,
): number {
  // Returns how many *new* signals were added this pass (used for early-exit).
  let newSignals = 0;

  // Even though we are paginating backwards (newest -> older),
  // the nodes are returned oldest -> newest so we need to reverse the order.
  const nodes = (pr.reviews?.nodes ?? []).reverse();

  // For each review node (newest -> oldest), capture latest per user and per team.
  for (const n of nodes) {
    if (!n) continue;

    const authorLogin =
      n.author && "login" in n.author ? n.author.login ?? null : null;
    const submittedAt = n.submittedAt;

    const onBehalfOfTeams =
      n.onBehalfOf?.nodes?.filter((t): t is Team => t !== null) ?? [];

    // Newest-to-older (because we use last/before). First time we see a user => their latest.
    if (authorLogin && !(authorLogin in userLatest)) {
      core.debug(
        `Found latest review by user: ${authorLogin} at ${submittedAt} - ${n.state}`,
      );
      userLatest[authorLogin] = {
        state: n.state,
        submittedAt,
        onBehalfOf: onBehalfOfTeams,
        url: n.url,
      };
      newSignals++;
    }

    for (const team of onBehalfOfTeams) {
      if (!(team.slug in teamLatest)) {
        core.debug(
          `Found latest review by team: ${team.slug} at ${submittedAt} - ${n.state}`,
        );
        teamLatest[team.slug] = {
          state: n.state,
          submittedAt,
          byUser: authorLogin,
          url: n.url,
        };
        newSignals++;
      }
    }
  }

  return newSignals;
}

function stopOrGetStartCursor(pr: PullRequest) {
  if (!pr || !pr.reviews || !pr.reviews.pageInfo) {
    return null;
  }
  const { hasPreviousPage, startCursor } = pr.reviews.pageInfo;
  if (!hasPreviousPage || !startCursor) return null;
  return startCursor;
}

// ----- Public API -----

/**
 * Returns the current "state of affairs" for reviews on a PR.
 * - Paginates backward (newest -> older) gathering latest per user/team.
 * - Captures who is currently requested (users & teams) and the overall reviewDecision.
 */
export async function getCurrentReviewStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  pageSize = 100, // 1..100
  maxPages = 10, // safety cap
): Promise<CurrentReviewStatus> {
  const last = Math.min(Math.max(pageSize, 1), 100);
  let before: string | null = null;
  let pagesFetched = 0;

  // Accumulators
  const userLatest: UserLatest = {};
  const teamLatest: TeamLatest = {};

  let reviewDecision: Maybe<PullRequestReviewDecisionOrUnknown> = null;
  let pendingUsers: PendingUsers = [];
  let pendingTeams: PendingTeams = [];

  // Loop newest -> older until we stop (no new signals or out of pages)
  while (pagesFetched < maxPages) {
    const { pr, rateLimit } = await fetchPage(
      octokit,
      owner,
      repo,
      prNumber,
      last,
      before,
    );

    if (rateLimit) {
      core.debug(`Rate limit: ${JSON.stringify(rateLimit, null, 2)}`);
    }

    if (pagesFetched === 0) {
      const pending = extractPending(pr);
      reviewDecision = pending.decision;
      pendingUsers = pending.pendingUsers;
      pendingTeams = pending.pendingTeams;
    }

    const added = accumulateLatestSignals(pr, userLatest, teamLatest);
    const startCursor = stopOrGetStartCursor(pr);
    if (added == 0 || startCursor === null) {
      break;
    }

    before = startCursor;
    pagesFetched += 1;
  }

  return {
    reviewDecision,
    pendingUsers,
    pendingTeams,
    userLatest,
    teamLatest,
  };
}
