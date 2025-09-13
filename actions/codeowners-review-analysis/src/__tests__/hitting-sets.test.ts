import { describe, it, expect, vi } from "vitest";

import { calculateAllMinimumHittingSets } from "../hitting-sets";
import { PullRequestReviewStateExt } from "../review-status";

import type { CodeownersEntry } from "../codeowners";
import type { ProcessedCodeOwnersEntry } from "../run";

// Helpers
function mkMap(
  pairs: Array<
    [{ owners: string[] }, { overallStatus: PullRequestReviewStateExt }]
  >,
): Map<CodeownersEntry, ProcessedCodeOwnersEntry> {
  return new Map(pairs) as Map<CodeownersEntry, ProcessedCodeOwnersEntry>;
}
function s(arr: string[]): string {
  return arr.join(",");
}
function toSortedStrings(result: Set<string[]>) {
  // serialize arrays for stable comparison (order of set iteration is not guaranteed)
  return [...result].map((a) => s(a)).sort();
}

describe("calculateAllMinimumHittingSets", () => {
  it("returns empty when there are no pending entries (empty map)", () => {
    const m = mkMap([]);
    const res = calculateAllMinimumHittingSets(m);
    expect(res.size).toBe(0);
  });

  it("returns empty when superset is empty (all entries approved)", () => {
    const e1 = { owners: ["a", "b"] };
    const e2 = { owners: ["b", "c"] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Approved }],
      [e2, { overallStatus: PullRequestReviewStateExt.Approved }],
    ]);
    const res = calculateAllMinimumHittingSets(m);
    expect(res.size).toBe(0);
  });

  it("finds the trivial single-owner solution", () => {
    const e1 = { owners: ["alice"] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);
    const res = calculateAllMinimumHittingSets(m);
    expect(toSortedStrings(res)).toEqual(["alice"]);
  });

  it("finds all minimum-cardinality hitting sets (size 2 example)", () => {
    // Subsets: {a,b}, {b,c}, {c,d}
    const e1 = { owners: ["a", "b"] };
    const e2 = { owners: ["b", "c"] };
    const e3 = { owners: ["c", "d"] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e3, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);

    const res = calculateAllMinimumHittingSets(m);
    // Minimum hitting sets of size 2 here include: [a,c], [b,c], [b,d]
    const got = toSortedStrings(res);
    expect(got).toEqual(["a,c", "b,c", "b,d"]);
  });

  it("ignores Approved entries when building subsets", () => {
    // One pending, one approved
    const e1 = { owners: ["a", "b"] }; // pending
    const e2 = { owners: ["c", "d"] }; // approved → must not affect result
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Approved }],
    ]);

    const res = calculateAllMinimumHittingSets(m);
    // For just {a,b}, minimum solutions are ["a"] and ["b"]
    const got = toSortedStrings(res);
    expect(got).toEqual(["a", "b"]);
  });

  it("drops inclusion-supersets: {a} makes {a,b,c} redundant", () => {
    // After removeSupersets, only {a} remains, so min hitting sets are ["a"].
    const e1 = { owners: ["a"] };
    const e2 = { owners: ["a", "b", "c"] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);
    const res = calculateAllMinimumHittingSets(m);
    expect(toSortedStrings(res)).toEqual(["a"]);
  });

  it("dedupes identical subsets via addIfUnique", () => {
    const e1 = { owners: ["x", "y"] };
    const e2 = { owners: ["y", "x"] }; // identical, different order
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);

    // Only one subset should be considered; min solutions are ["x"] and ["y"].
    const res = calculateAllMinimumHittingSets(m);
    const got = toSortedStrings(res);
    expect(got).toEqual(["x", "y"]);
  });

  it("returns empty if all pending entries have empty owners (filtered out → no subsets)", () => {
    const e1 = { owners: [] };
    const e2 = { owners: [] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);

    // getSupersetAndSubsets() will skip empty owner lists; subsets.length === 0 → empty result
    const res = calculateAllMinimumHittingSets(m);
    expect(res.size).toBe(0);
  });

  it("returns empty when superset size exceeds 12 (guard)", () => {
    const manyOwners = Array.from({ length: 13 }, (_, i) => `o${i}`);
    const e1 = { owners: manyOwners };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);
    const res = calculateAllMinimumHittingSets(m);
    expect(res.size).toBe(0);
  });

  it("works with mixed statuses and multiple minimum solutions", () => {
    // Pending: {a,b}, {b,c}, Approved: {c,d}
    const e1 = { owners: ["a", "b"] };
    const e2 = { owners: ["b", "c"] };
    const e3 = { owners: ["c", "d"] };
    const m = mkMap([
      [e1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e2, { overallStatus: PullRequestReviewStateExt.Pending }],
      [e3, { overallStatus: PullRequestReviewStateExt.Approved }],
    ]);
    const res = calculateAllMinimumHittingSets(m);
    // Only {a,b} and {b,c} matter → min solutions are ["a","c"] and ["b"]
    // Wait: check carefully — to hit {a,b} and {b,c}:
    //  - ["b"] alone hits both → size 1 is minimum.
    const got = toSortedStrings(res);
    expect(got).toEqual(["b"]);
  });
});

describe("calculateAllMinimumHittingSets (complex scenario)", () => {
  it("handles supersets, duplicates, approved entries, singletons, and chains", () => {
    // ---- Structure ----
    // Block A (needs 3 owners min):
    //   S1 = {A,B}
    //   S2 = {B,C,D}
    //   S3 = {A,E}
    //   S4 = {C,E}
    //   S5 = {D,F}
    //
    // Minimal size-3 hitting set options for Block A:
    //   {B,D,E}, {B,E,F}, {A,C,D}, {A,C,F}, {A,D,E}
    //
    // Block B (singleton forces inclusion):
    //   S6 = {G}
    //
    // Block C (4-edge chain → unique size-2 cover):
    //   {H,I}, {I,J}, {J,K}, {K,L}  → minimal {I,K}
    //
    // Extra noise:
    //   - Superset: {A,B,C,D,E,F,G,H} (should be removed by removeSupersets)
    //   - Duplicate subset: another {A,B} in different order
    //   - Approved entry: {C,D} (ignored)
    //   - Empty-owner entries: [], [] (ignored)
    //
    // Expected minimum size = 3 (Block A) + 1 (G) + 2 (I,K) = 6
    // Number of minimum solutions = 5 (from Block A’s 5 choices)

    // Block A
    const eA1 = { owners: ["A", "B"] };
    const eA2 = { owners: ["B", "C", "D"] };
    const eA3 = { owners: ["A", "E"] };
    const eA4 = { owners: ["C", "E"] };
    const eA5 = { owners: ["D", "F"] };

    // Duplicate of {A,B} (different order) → should be deduped
    const eA1dup = { owners: ["B", "A"] };

    // Superset that should be dropped by removeSupersets
    const eSuperset = {
      owners: ["A", "B", "C", "D", "E", "F", "G", "H"],
    };

    // Block B: singleton
    const eB = { owners: ["G"] };

    // Block C: chain
    const eC1 = { owners: ["H", "I"] };
    const eC2 = { owners: ["I", "J"] };
    const eC3 = { owners: ["J", "K"] };
    const eC4 = { owners: ["K", "L"] };

    // Approved (ignored)
    const eApproved = { owners: ["C", "D"] };

    // Empty owners (ignored by getter)
    const eEmpty1 = { owners: [] };
    const eEmpty2 = { owners: [] };

    const m = mkMap([
      [eA1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eA2, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eA3, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eA4, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eA5, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eA1dup, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eSuperset, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eB, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eC1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eC2, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eC3, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eC4, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eApproved, { overallStatus: PullRequestReviewStateExt.Approved }],
      [eEmpty1, { overallStatus: PullRequestReviewStateExt.Pending }],
      [eEmpty2, { overallStatus: PullRequestReviewStateExt.Pending }],
    ]);

    const res = calculateAllMinimumHittingSets(m);
    const key = (arr: string[]) => arr.join(",");

    // Expect size 6 solutions; enumerate all expected minimal solutions (5 of them):
    // Block A options × {G} × {I,K}
    const expected = [
      ["A", "C", "D", "G", "I", "K"],
      ["A", "C", "F", "G", "I", "K"],
      ["A", "D", "E", "G", "I", "K"],
      ["B", "D", "E", "G", "I", "K"],
      ["B", "E", "F", "G", "I", "K"],
    ]
      .map((a) => key(a))
      .sort();

    const got = toSortedStrings(res);

    // Basic shape checks
    expect(res.size).toBe(expected.length);
    expect(got).toEqual(expected);

    // Ensure every returned set is size 6 (minimum for this construction)
    for (const arr of res) expect(arr.length).toBe(6);
  });
});
