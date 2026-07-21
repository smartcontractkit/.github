import { describe, test, expect } from "vitest";

import { extractRefsFromBody, isFullSha, validateGitRef } from "../refs";

describe("validateGitRef", () => {
  test("accepts a 40-char lowercase SHA", () => {
    const sha = "a".repeat(40);
    expect(validateGitRef(sha)).toBe(sha);
  });

  test("accepts a short SHA (7 chars)", () => {
    expect(validateGitRef("abc1234")).toBe("abc1234");
  });

  test("accepts a 4-char SHA (minimum)", () => {
    expect(validateGitRef("abcd")).toBe("abcd");
  });

  test("accepts uppercase-hex short SHAs", () => {
    expect(validateGitRef("ABCDEF0")).toBe("ABCDEF0");
  });

  test("accepts a plain semver tag", () => {
    expect(validateGitRef("1.2.3")).toBe("1.2.3");
  });

  test("accepts a v-prefixed semver tag", () => {
    expect(validateGitRef("v1.2.3")).toBe("v1.2.3");
  });

  test("accepts a semver tag with prerelease", () => {
    expect(validateGitRef("v1.2.3-beta.1")).toBe("v1.2.3-beta.1");
  });

  test("accepts a semver tag with build metadata", () => {
    expect(validateGitRef("1.2.3+build.42")).toBe("1.2.3+build.42");
  });

  test("accepts a simple branch name", () => {
    expect(validateGitRef("develop")).toBe("develop");
  });

  test("accepts a branch name with slashes", () => {
    expect(validateGitRef("feature/CCIP-1234-something")).toBe(
      "feature/CCIP-1234-something",
    );
  });

  test("accepts a branch name with dots", () => {
    expect(validateGitRef("release-1.0.x")).toBe("release-1.0.x");
  });

  test("rejects an empty ref", () => {
    expect(() => validateGitRef("")).toThrow(/empty/i);
  });

  test("rejects a ref longer than 255 chars", () => {
    const long = "a".repeat(256);
    expect(() => validateGitRef(long)).toThrow(/too long/);
  });

  test("rejects a version-like ref that fails semver (leading zeros)", () => {
    expect(() => validateGitRef("v01.02.03")).toThrow(/Invalid SemVer/);
  });

  test("rejects a ref with spaces", () => {
    expect(() => validateGitRef("feature branch")).toThrow(/Invalid Git/);
  });

  test("rejects a ref ending with .lock", () => {
    expect(() => validateGitRef("feature.lock")).toThrow(/Invalid Git/);
  });

  test("rejects a ref with '..'", () => {
    expect(() => validateGitRef("foo..bar")).toThrow(/Invalid Git/);
  });

  test("rejects a ref with backslashes", () => {
    expect(() => validateGitRef("foo\\bar")).toThrow(/Invalid Git/);
  });

  test("rejects a ref starting with a dot", () => {
    expect(() => validateGitRef(".hidden")).toThrow(/Invalid Git/);
  });

  test("rejects a ref containing '@{'", () => {
    expect(() => validateGitRef("foo@{bar")).toThrow(/Invalid Git/);
  });

  test("rejects a ref with a colon", () => {
    expect(() => validateGitRef("foo:bar")).toThrow(/Invalid Git/);
  });
});

describe("isFullSha", () => {
  test("returns true for 40-char lowercase hex", () => {
    expect(isFullSha("a".repeat(40))).toBe(true);
  });

  test("returns true for 40-char uppercase hex", () => {
    expect(isFullSha("A".repeat(40))).toBe(true);
  });

  test("returns false for 39-char hex", () => {
    expect(isFullSha("a".repeat(39))).toBe(false);
  });

  test("returns false for a short SHA", () => {
    expect(isFullSha("abc1234")).toBe(false);
  });

  test("returns false for a branch name", () => {
    expect(isFullSha("develop")).toBe(false);
  });
});

describe("extractRefsFromBody", () => {
  test("extracts refs for all three repos when all present", () => {
    const body = `
      description here
      core ref: my-core-branch
      solana ref: v1.2.3
      starknet ref: abc1234
    `;
    const refs = extractRefsFromBody(body);
    expect(refs.core).toBe("my-core-branch");
    expect(refs.solana).toBe("v1.2.3");
    expect(refs.starknet).toBe("abc1234");
  });

  test("returns undefined for missing repos", () => {
    const body = "core ref: some-branch";
    const refs = extractRefsFromBody(body);
    expect(refs.core).toBe("some-branch");
    expect(refs.solana).toBeUndefined();
    expect(refs.starknet).toBeUndefined();
  });

  test("case-insensitive on the label", () => {
    const body = "CORE Ref: main\nSolana REF: develop";
    const refs = extractRefsFromBody(body);
    expect(refs.core).toBe("main");
    expect(refs.solana).toBe("develop");
  });

  test("returns undefined values for empty body", () => {
    const refs = extractRefsFromBody("");
    expect(refs.core).toBeUndefined();
    expect(refs.solana).toBeUndefined();
    expect(refs.starknet).toBeUndefined();
  });
});
