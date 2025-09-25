import { describe, it, expect } from "vitest";

import {
  getOverallStateForAllEntries,
  getOverallStateForSingleEntry,
  filterFor,
  PullRequestReviewStateExt,
} from "../review-status";

const E = PullRequestReviewStateExt;
const entry = (state: PullRequestReviewStateExt) => ({ state });

describe("getOverallStateForAllEntries", () => {
  it("returns Pending for empty map", () => {
    expect(getOverallStateForAllEntries(new Map())).toBe(E.Pending);
  });

  it("returns ChangesRequested if any entry has ChangesRequested", () => {
    const m = new Map([
      ["a", entry(E.Approved)],
      ["b", entry(E.ChangesRequested)],
      ["c", entry(E.Pending)],
    ]);
    expect(getOverallStateForAllEntries(m)).toBe(E.ChangesRequested);
  });

  it("returns Pending if any entry is Pending (and none are ChangesRequested)", () => {
    const m = new Map([
      ["a", entry(E.Approved)],
      ["b", entry(E.Pending)],
      ["c", entry(E.Approved)],
    ]);
    expect(getOverallStateForAllEntries(m)).toBe(E.Pending);
  });

  it("returns Approved only if all entries are Approved", () => {
    const allApproved = new Map([
      ["a", entry(E.Approved)],
      ["b", entry(E.Approved)],
    ]);
    expect(getOverallStateForAllEntries(allApproved)).toBe(E.Approved);

    const mixed = new Map([
      ["a", entry(E.Approved)],
      ["b", entry(E.Commented)],
    ]);
    expect(getOverallStateForAllEntries(mixed)).toBe(E.Commented);
  });

  it("returns Unknown when no ChangesRequested/Pending and not all Approved", () => {
    const m = new Map([
      ["a", entry(E.Commented)],
      ["b", entry(E.Dismissed)],
    ]);
    expect(getOverallStateForAllEntries(m)).toBe(E.Commented);
  });
});

describe("getOverallStateForSingleEntry", () => {
  it("returns Pending for empty list", () => {
    expect(getOverallStateForSingleEntry([])).toBe(E.Pending);
  });

  it("obeys precedence: ChangesRequested > Approved > Commented > Dismissed > Pending > Unknown", () => {
    // Any ChangesRequested wins
    expect(
      getOverallStateForSingleEntry([
        entry(E.Pending),
        entry(E.Approved),
        entry(E.ChangesRequested),
      ]),
    ).toBe(E.ChangesRequested);

    // Approved beats Commented/Dismissed/Pending/Unknown (without ChangesRequested)
    expect(
      getOverallStateForSingleEntry([
        entry(E.Commented),
        entry(E.Dismissed),
        entry(E.Approved),
        entry(E.Pending),
        entry(E.Unknown),
      ]),
    ).toBe(E.Approved);

    // Commented beats Dismissed/Pending/Unknown
    expect(
      getOverallStateForSingleEntry([
        entry(E.Dismissed),
        entry(E.Pending),
        entry(E.Commented),
        entry(E.Unknown),
      ]),
    ).toBe(E.Commented);

    // Dismissed beats Pending/Unknown
    expect(
      getOverallStateForSingleEntry([
        entry(E.Unknown),
        entry(E.Dismissed),
        entry(E.Pending),
      ]),
    ).toBe(E.Dismissed);

    // Pending beats Unknown
    expect(
      getOverallStateForSingleEntry([entry(E.Unknown), entry(E.Pending)]),
    ).toBe(E.Pending);

    // Only Unknowns → Unknown
    expect(getOverallStateForSingleEntry([entry(E.Unknown)])).toBe(E.Unknown);
  });

  it("handles single-element arrays directly", () => {
    expect(getOverallStateForSingleEntry([entry(E.Approved)])).toBe(E.Approved);
    expect(getOverallStateForSingleEntry([entry(E.Pending)])).toBe(E.Pending);
    expect(getOverallStateForSingleEntry([entry(E.ChangesRequested)])).toBe(
      E.ChangesRequested,
    );
  });
});

describe("filterFor", () => {
  const list = [
    entry(E.Approved),
    entry(E.Pending),
    entry(E.Approved),
    entry(E.Commented),
  ];

  it("returns only items matching the given state", () => {
    const approved = filterFor(list, E.Approved);
    expect(approved).toHaveLength(2);
    expect(approved.every((e) => e.state === E.Approved)).toBe(true);

    const pending = filterFor(list, E.Pending);
    expect(pending).toHaveLength(1);
    expect(pending[0].state).toBe(E.Pending);
  });

  it("returns empty array when no items match", () => {
    const dismissed = filterFor(list, E.Dismissed);
    expect(dismissed).toEqual([]);
  });
});
