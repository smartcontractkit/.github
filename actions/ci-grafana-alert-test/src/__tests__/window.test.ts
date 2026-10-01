import { describe, expect, it } from "vitest";

import {
  addSecondsToRfc3339,
  MAX_OBSERVATION_WINDOW,
  parseObservationWindow,
  resolveCheckWindow,
  resolveLiveWindow,
  toRfc3339Utc,
} from "../window";

describe("parseObservationWindow", () => {
  it("parses a single minute", () => {
    expect(parseObservationWindow("10m")).toBe(600);
  });

  it("parses compound durations in h/m/s order", () => {
    expect(parseObservationWindow("1h30m")).toBe(5400);
    expect(parseObservationWindow("1h30m45s")).toBe(5445);
  });

  it("parses seconds and hours independently", () => {
    expect(parseObservationWindow("45s")).toBe(45);
    expect(parseObservationWindow("2h")).toBe(7200);
  });

  it("rejects an empty duration", () => {
    expect(() => parseObservationWindow("")).toThrow("must be positive");
  });

  it("rejects zero-valued segments", () => {
    expect(() => parseObservationWindow("0m")).toThrow("must be positive");
  });

  it("rejects unknown units", () => {
    expect(() => parseObservationWindow("10x")).toThrow(
      "'observation_window' must use h/m/s units",
    );
  });

  it("rejects whitespace", () => {
    expect(() => parseObservationWindow("10 m")).toThrow("h/m/s units");
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

  it("computes to from observation_window", () => {
    expect(resolveCheckWindow("2024-01-15T10:00:00Z", "", "10m")).toEqual({
      from: "2024-01-15T10:00:00Z",
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("leaves an absent from to the CLI to reject", () => {
    expect(resolveCheckWindow("", "2024-01-15T10:10:00Z", "")).toEqual({
      from: "",
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("requires exactly one of to or observation_window", () => {
    expect(() => resolveCheckWindow("2024-01-15T10:00:00Z", "", "")).toThrow(
      "exactly one of 'to' or 'observation_window'",
    );
    expect(() =>
      resolveCheckWindow("2024-01-15T10:00:00Z", "2024-01-15T10:10:00Z", "10m"),
    ).toThrow("mutually exclusive");
  });

  it("allows an explicit window of exactly the maximum length", () => {
    expect(() =>
      resolveCheckWindow("2024-01-15T10:00:00Z", "2024-01-15T15:30:00Z", ""),
    ).not.toThrow();
  });

  it("rejects an explicit window longer than the maximum", () => {
    expect(() =>
      resolveCheckWindow("2024-01-15T10:00:00Z", "2024-01-15T15:30:01Z", ""),
    ).toThrow(`${MAX_OBSERVATION_WINDOW}: GitHub Actions runners`);
  });

  it("allows an observation_window of exactly the maximum length", () => {
    expect(() =>
      resolveCheckWindow("2024-01-15T10:00:00Z", "", "5h30m"),
    ).not.toThrow();
  });

  it("rejects an observation_window longer than the maximum", () => {
    expect(() => resolveCheckWindow("2024-01-15T10:00:00Z", "", "6h")).toThrow(
      `${MAX_OBSERVATION_WINDOW}: GitHub Actions runners`,
    );
  });
});

describe("resolveLiveWindow", () => {
  const now = new Date("2024-01-15T10:00:00Z");

  it("passes through an explicit to and omits an absent from", () => {
    expect(resolveLiveWindow("", "2024-01-15T10:10:00Z", "", now)).toEqual({
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("computes to from observation_window measured from the start of the live run", () => {
    expect(resolveLiveWindow("", "", "10m", now)).toEqual({
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("measures observation_window from now even when an explicit from is given", () => {
    expect(resolveLiveWindow("2024-01-15T09:00:00Z", "", "10m", now)).toEqual({
      from: "2024-01-15T09:00:00Z",
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("preserves fractional seconds when computing to from observation_window", () => {
    expect(
      resolveLiveWindow("", "", "1s", new Date("2024-01-15T10:00:00.900Z")),
    ).toEqual({ to: "2024-01-15T10:00:01.900Z" });
  });

  it("carries an explicit from with an explicit to", () => {
    expect(
      resolveLiveWindow(
        "2024-01-15T09:55:00Z",
        "2024-01-15T10:10:00Z",
        "",
        now,
      ),
    ).toEqual({
      from: "2024-01-15T09:55:00Z",
      to: "2024-01-15T10:10:00Z",
    });
  });

  it("passes a past or invalid to through for the CLI to reject", () => {
    expect(resolveLiveWindow("", "2024-01-15T09:00:00Z", "", now)).toEqual({
      to: "2024-01-15T09:00:00Z",
    });
    expect(resolveLiveWindow("", "not-a-date", "", now)).toEqual({
      to: "not-a-date",
    });
  });

  it("requires exactly one of to or observation_window", () => {
    expect(() => resolveLiveWindow("", "", "", now)).toThrow(
      "exactly one of 'to' or 'observation_window'",
    );
    expect(() =>
      resolveLiveWindow("", "2024-01-15T10:10:00Z", "10m", now),
    ).toThrow("mutually exclusive");
  });

  it("rejects an observation_window longer than the maximum", () => {
    expect(() => resolveLiveWindow("", "", "6h", now)).toThrow(
      `${MAX_OBSERVATION_WINDOW}: GitHub Actions runners`,
    );
  });

  it("rejects a to more than the maximum ahead of the live start", () => {
    expect(() =>
      resolveLiveWindow("", "2024-01-15T15:30:01Z", "", now),
    ).toThrow(`${MAX_OBSERVATION_WINDOW}: GitHub Actions runners`);
  });

  it("measures the limit from now, so a historical from is only a blind spot", () => {
    expect(
      resolveLiveWindow(
        "2024-01-14T10:00:00Z",
        "2024-01-15T10:10:00Z",
        "",
        now,
      ),
    ).toEqual({
      from: "2024-01-14T10:00:00Z",
      to: "2024-01-15T10:10:00Z",
    });
    expect(resolveLiveWindow("2024-01-15T04:00:00Z", "", "1m", now)).toEqual({
      from: "2024-01-15T04:00:00Z",
      to: "2024-01-15T10:01:00Z",
    });
  });

  it("still rejects a to more than the maximum from now despite a historical from", () => {
    expect(() =>
      resolveLiveWindow(
        "2024-01-14T10:00:00Z",
        "2024-01-15T15:30:01Z",
        "",
        now,
      ),
    ).toThrow(`${MAX_OBSERVATION_WINDOW}: GitHub Actions runners`);
  });
});
