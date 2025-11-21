import { describe, test, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import { getRunInputStringArray } from "../run-inputs";

// We'll control what core.getInput returns via this mutable value.
let mockInputValue = "";

// Mock @actions/core methods we use.
vi.mock("@actions/core", () => ({
  info: vi.fn(),
  // Simulate the GitHub Actions behavior:
  // - Return `mockInputValue` when present.
  // - Throw if required=true and value is falsy (empty string).
  getInput: vi.fn((name: string, opts?: { required?: boolean }) => {
    if (opts?.required && !mockInputValue) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return mockInputValue;
  }),
}));

describe("getRunInputStringArray", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInputValue = "";
  });

  test("returns [] when no input is provided and required=false", () => {
    mockInputValue = "";
    const result = getRunInputStringArray("filePatterns", false);
    expect(result).toEqual([]);
    expect(core.info).not.toHaveBeenCalled(); // no parsing log if nothing to parse
  });

  test("throws when required=true and no input is provided", () => {
    mockInputValue = "";
    expect(() => getRunInputStringArray("filePatterns", true)).toThrow(
      /Input required and not supplied/i,
    );
  });

  test("comma-separated values are split by comma and trimmed", () => {
    mockInputValue = "src/**/*.ts,  test/**/*.ts ,docs/**/*.md";
    const result = getRunInputStringArray("filePatterns", false);
    expect(result).toEqual(["src/**/*.ts", "test/**/*.ts", "docs/**/*.md"]);
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/separator ','/),
    );
  });

  test("newline-separated values are split by newline and trimmed", () => {
    mockInputValue = "src/**/*.ts\ntest/**/*.ts\n\ndocs/**/*.md   ";
    const result = getRunInputStringArray("filePatterns", false);
    expect(result).toEqual(["src/**/*.ts", "test/**/*.ts", "docs/**/*.md"]);
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/separator '\n'/),
    );
  });

  test("Windows newlines (\\r\\n) are handled via trim when using newline separator", () => {
    mockInputValue = "a/**/*.ts\r\nb/**/*.ts\r\nc/**/*.ts";
    const result = getRunInputStringArray("filePatterns", false);
    expect(result).toEqual(["a/**/*.ts", "b/**/*.ts", "c/**/*.ts"]);
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/separator '\n'/),
    );
  });

  test("mixed commas and newlines: chooses comma as separator when any comma exists", () => {
    // NOTE: Implementation prefers ',' if present at all.
    mockInputValue = "a/**/*.ts\nb/**/*.ts, c/**/*.ts\nd/**/*.ts";
    const result = getRunInputStringArray("filePatterns", false);
    // Because comma is chosen, we split into chunks around commas.
    // Newlines remain inside items and then are trimmed (but not split further).
    // After trim, items may still contain '\n' if not at edges.
    expect(result).toEqual(["a/**/*.ts\nb/**/*.ts", "c/**/*.ts\nd/**/*.ts"]);
    expect(core.info).toHaveBeenCalledWith(
      expect.stringMatching(/separator ','/),
    );
  });

  test("filters out empty segments after trimming", () => {
    mockInputValue = "src/**/*.ts,,  \n  , test/**/*.ts\n\n";
    // Contains both comma and newline -> comma wins, empty pieces removed.
    const result = getRunInputStringArray("filePatterns", false);
    // With comma separator, this becomes ["src/**/*.ts", "", "  \n  ", " test/**/*.ts\n\n"]
    // After trimming & filtering empties: ["src/**/*.ts", "test/**/*.ts"]
    expect(result).toEqual(["src/**/*.ts", "test/**/*.ts"]);
  });
});
