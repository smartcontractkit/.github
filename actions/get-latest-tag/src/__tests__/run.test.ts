import { describe, test, expect, vi, beforeEach } from "vitest";

import { SemVer } from "semver";

import { parseMatchingRef } from "../run";
import { generateNewVersionInfo } from "../run";

import type { ParsedMatchingTag } from "../run";

vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  endGroup: vi.fn(),
}));

describe("parseMatchingRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("correctly parses a valid tag ref with prefix", () => {
    const ref = "refs/tags/v1.2.3";
    const prefix = "v";

    const result = parseMatchingRef({ ref }, prefix);

    expect(result).not.toBeNull();
    expect(result?.rawRef).toBe(ref);
    expect(result?.strippedRef).toBe("v1.2.3");
    expect(result?.strippedTag).toBe("1.2.3");
    expect(result?.semver.version).toBe("1.2.3");
  });

  test("correctly parses a valid tag ref with prefix (simple)", () => {
    const ref = "refs/tags/release-2.0.0";
    const prefix = "release-";

    const result = parseMatchingRef({ ref }, prefix);

    expect(result).not.toBeNull();
    expect(result?.rawRef).toBe(ref);
    expect(result?.strippedRef).toBe("release-2.0.0");
    expect(result?.strippedTag).toBe("2.0.0");
    expect(result?.semver.version).toBe("2.0.0");
  });

  test("correctly parses a valid tag ref with prefix (complex)", () => {
    const ref = "refs/tags/path/to/module/v3.4.5-alpha.1";
    const prefix = "path/to/module/v";

    const result = parseMatchingRef({ ref }, prefix);

    expect(result).not.toBeNull();
    expect(result?.rawRef).toBe(ref);
    expect(result?.strippedRef).toBe("path/to/module/v3.4.5-alpha.1");
    expect(result?.strippedTag).toBe("3.4.5-alpha.1");
    expect(result?.semver.version).toBe("3.4.5-alpha.1");
  });

  test("returns null for a ref that does not start with expected prefix", () => {
    const ref = "refs/tags/release-1.2.3";
    const prefix = "v";

    const result = parseMatchingRef({ ref }, prefix);

    expect(result).toBeNull();
  });

  test("returns null for a ref that does not contain a valid semver version after the prefix", () => {
    const ref = "refs/tags/v1.2";
    const prefix = "v";

    const result = parseMatchingRef({ ref }, prefix);

    expect(result).toBeNull();
  });
});

describe("generateNewVersionInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("correctly generates new version info for a standard semver tag", () => {
    const mostRecentTag: ParsedMatchingTag = {
      rawRef: "refs/tags/v1.2.3",
      strippedRef: "v1.2.3",
      strippedTag: "1.2.3",
      semver: new SemVer("1.2.3"),
    };

    const result = generateNewVersionInfo(mostRecentTag);
    expect(result.major.version).toBe("2.0.0");
    expect(result.major.tag).toBe("v2.0.0");
    expect(result.minor.version).toBe("1.3.0");
    expect(result.minor.tag).toBe("v1.3.0");
    expect(result.patch.version).toBe("1.2.4");
    expect(result.patch.tag).toBe("v1.2.4");
  });

  test("correctly generates new version info for a prefixed tag", () => {
    const mostRecentTag: ParsedMatchingTag = {
      rawRef: "refs/tags/release-2.0.0",
      strippedRef: "release-2.0.0",
      strippedTag: "2.0.0",
      semver: new SemVer("2.0.0"),
    };

    const result = generateNewVersionInfo(mostRecentTag);
    expect(result.major.version).toBe("3.0.0");
    expect(result.major.tag).toBe("release-3.0.0");
    expect(result.minor.version).toBe("2.1.0");
    expect(result.minor.tag).toBe("release-2.1.0");
    expect(result.patch.version).toBe("2.0.1");
    expect(result.patch.tag).toBe("release-2.0.1");
  });

  test("correctly generates new version info for a complex semver tag", () => {
    const mostRecentTag: ParsedMatchingTag = {
      rawRef: "refs/tags/path/to/module/v3.4.5",
      strippedRef: "path/to/module/v3.4.5",
      strippedTag: "3.4.5",
      semver: new SemVer("3.4.5"),
    };

    const result = generateNewVersionInfo(mostRecentTag);
    expect(result.major.version).toBe("4.0.0");
    expect(result.major.tag).toBe("path/to/module/v4.0.0");
    expect(result.minor.version).toBe("3.5.0");
    expect(result.minor.tag).toBe("path/to/module/v3.5.0");
    expect(result.patch.version).toBe("3.4.6");
    expect(result.patch.tag).toBe("path/to/module/v3.4.6");
  });
});
