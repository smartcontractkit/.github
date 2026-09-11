import { describe, expect, it } from "vitest";

import {
  addSecondsToRfc3339,
  parseDuration,
  resolveCheckWindow,
  toRfc3339Utc,
} from "../window";

describe("parseDuration", () => {
  it("parses a single minute", () => {
    expect(parseDuration("10m")).toBe(600);
  });

  it("parses compound durations in h/m/s order", () => {
    expect(parseDuration("1h30m")).toBe(5400);
    expect(parseDuration("1h30m45s")).toBe(5445);
  });

  it("parses seconds and hours independently", () => {
    expect(parseDuration("45s")).toBe(45);
    expect(parseDuration("2h")).toBe(7200);
  });

  it("rejects an empty duration", () => {
    expect(() => parseDuration("")).toThrow("must be positive");
  });

  it("rejects zero-valued segments", () => {
    expect(() => parseDuration("0m")).toThrow("must be positive");
  });

  it("rejects unknown units", () => {
    expect(() => parseDuration("10x")).toThrow(
      "'duration' must use h/m/s units",
    );
  });

  it("rejects whitespace", () => {
    expect(() => parseDuration("10 m")).toThrow("h/m/s units");
  });
});

describe("toRfc3339Utc", () => {
  it("formats a UTC date without milliseconds", () => {
    const date = new Date("2024-01-15T10:30:45Z");
    expect(toRfc3339Utc(date)).toBe("2024-01-15T10:30:45Z");
  });
});

describe("addSecondsToRfc3339", () => {
  it("adds seconds across a minute boundary", () => {
    expect(addSecondsToRfc3339("2024-01-15T10:30:00Z", 90)).toBe(
      "2024-01-15T10:31:30Z",
    );
  });

  it("normalizes a non-UTC offset to UTC", () => {
    expect(addSecondsToRfc3339("2024-01-15T10:30:00+02:00", 0)).toBe(
      "2024-01-15T08:30:00Z",
    );
  });

  it("rejects an invalid timestamp", () => {
    expect(() => addSecondsToRfc3339("not-a-date", 60)).toThrow(
      "not a valid RFC3339",
    );
  });
});

describe("resolveCheckWindow", () => {
  it("passes through an explicit to", () => {
    expect(
      resolveCheckWindow("2024-01-15T10:00:00Z", "2024-01-15T10:10:00Z", ""),
    ).toEqual({ from: "2024-01-15T10:00:00Z", to: "2024-01-15T10:10:00Z" });
  });

  it("computes to from duration", () => {
    expect(resolveCheckWindow("2024-01-15T10:00:00Z", "", "10m")).toEqual({
      from: "2024-01-15T10:00:00Z",
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("requires from", () => {
    expect(() => resolveCheckWindow("", "2024-01-15T10:10:00Z", "")).toThrow(
      "'from' is required",
    );
  });

  it("requires exactly one of to or duration", () => {
    expect(() => resolveCheckWindow("2024-01-15T10:00:00Z", "", "")).toThrow(
      "exactly one of 'to' or 'duration'",
    );
    expect(() =>
      resolveCheckWindow("2024-01-15T10:00:00Z", "2024-01-15T10:10:00Z", "10m"),
    ).toThrow("mutually exclusive");
  });
});
