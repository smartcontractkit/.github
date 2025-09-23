import type { CodeownersEntry } from "./codeowners";
import type { ProcessedCodeOwnersEntry } from "./run";

import { PullRequestReviewStateExt } from "./review-status";

// We calculate the smallest sets of pending reviewers that satisfy all pending codeowners entries.
// This is a brute-force combinatorial approach, which is feasible for small sets.
// We've limited the superset size to 12 owners to avoid combinatorial explosion.
// See: https://en.wikipedia.org/wiki/Set_cover_problem

/**
 * Calculates all minimum hitting sets of owners that can satisfy all pending codeowners review entries.
 */
export function calculateAllMinimumHittingSets(
  reviewSummary: Map<CodeownersEntry, ProcessedCodeOwnersEntry>,
) {
  const { superset, subsets } = getSupersetAndSubsets(reviewSummary);

  // Quick sanity check to avoid combinatorial explosion
  if (superset.size === 0 || superset.size > 12 || subsets.length === 0) {
    return new Set<string[]>();
  }

  for (let k = 1; k <= superset.size; k++) {
    const validHittingSets: Set<string[]> = new Set();

    for (const combo of combinations(superset, k)) {
      const candidateSet = new Set(combo);

      const hitsAll = subsets.every((subset) => {
        for (const elem of subset) {
          if (candidateSet.has(elem)) {
            return true;
          }
        }
        return false;
      });

      if (hitsAll) {
        validHittingSets.add(combo);
      }
    }
    if (validHittingSets.size > 0) {
      return validHittingSets;
    }
  }

  return new Set<string[]>();
}

/**
 * Generates all combinations of k elements from the input array.
 */
function combinations(superset: Set<string>, k: number) {
  const supersetArr = Array.from(superset).sort();
  const results: string[][] = [];

  function backtrack(start: number, path: string[]) {
    if (path.length === k) {
      results.push([...path]);
      return;
    }

    for (let i = start; i < supersetArr.length; i++) {
      path.push(supersetArr[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  }

  backtrack(0, []);
  return results;
}

/**
 * Gets the superset of all pending owners and the subsets of owners for each pending entry.
 */
function getSupersetAndSubsets(
  reviewSummary: Map<CodeownersEntry, ProcessedCodeOwnersEntry>,
) {
  const allPendingOwners = new Set<string>();
  const allPendingEntries: Set<string>[] = [];

  const subsetsSeen = new Set<string>();
  for (const [entry, processed] of reviewSummary.entries()) {
    if (processed.overallStatus !== PullRequestReviewStateExt.Approved) {
      entry.owners.forEach((owner) => {
        allPendingOwners.add(owner);
      });

      if (entry.owners.length > 0) {
        addIfUnique(subsetsSeen, allPendingEntries, entry.owners);
      }
    }
  }

  const minimizedSubsets = removeSupersets(allPendingEntries);
  return { superset: allPendingOwners, subsets: minimizedSubsets };
}

function addIfUnique<T>(seen: Set<string>, set: Set<T>[], item: T[]) {
  const normalized = JSON.stringify([...item].sort());
  if (!seen.has(normalized)) {
    seen.add(normalized);
    set.push(new Set(item));
  }
}

// Keep only inclusion-minimal subsets: drop any set that is a superset of another.
// For example:
// - {A,B}, {A,B,C}, {B,C}  →  {A,B}, {B,C}
// - {A},{A,B,C}, {A,B,D}  →  {A}
function removeSupersets(sets: Set<string>[]): Set<string>[] {
  // Normalize to sorted arrays for easy subset checks
  const arrs = sets.map((s) => [...s].sort());
  // Sort by length so smaller sets are considered first
  arrs.sort((a, b) => a.length - b.length);

  const keep: string[][] = [];
  outer: for (const S of arrs) {
    for (const T of keep) {
      if (isSubset(T, S)) {
        // S is a superset of T → redundant, skip S
        continue outer;
      }
    }
    keep.push(S);
  }
  return keep.map((a) => new Set(a));
}

function isSubset(A: string[], B: string[]): boolean {
  // A, B sorted; check A ⊆ B with two pointers
  let i = 0,
    j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) {
      i++;
      j++;
    } else if (A[i] > B[j]) {
      j++;
    } else {
      return false;
    }
  }
  return i === A.length;
}
