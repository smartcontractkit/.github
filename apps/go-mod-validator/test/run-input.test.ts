import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRunInputRepoBranchExceptions, shaMatches } from "../src/run-inputs";
import * as core from "@actions/core";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

const mockedCore = vi.mocked(core);

describe("getRunInputRepoBranchExceptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map when input is empty", () => {
    mockedCore.getInput.mockReturnValue("");

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("parses single repo with single branch", () => {
    mockedCore.getInput.mockReturnValue("smartcontractkit/.github:main");

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(1);
    expect(result.get("smartcontractkit/.github")).toEqual(["main"]);
  });

  it("parses single repo with multiple branches", () => {
    mockedCore.getInput.mockReturnValue(
      "smartcontractkit/.github:main,develop,foo/bar",
    );

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(1);
    expect(result.get("smartcontractkit/.github")).toEqual([
      "main",
      "develop",
      "foo/bar",
    ]);
  });

  it("parses multiple repos with single branches", () => {
    const input = `smartcontractkit/.github:main
smartcontractkit/foo:develop`;
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(2);
    expect(result.get("smartcontractkit/.github")).toEqual(["main"]);
    expect(result.get("smartcontractkit/foo")).toEqual(["develop"]);
  });

  it("parses multiple repos with multiple branches", () => {
    const input = `smartcontractkit/.github:main,develop
smartcontractkit/foo:v1.0,v2.0,develop
smartcontractkit/bar:feature/test`;
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(3);
    expect(result.get("smartcontractkit/.github")).toEqual(["main", "develop"]);
    expect(result.get("smartcontractkit/foo")).toEqual([
      "v1.0",
      "v2.0",
      "develop",
    ]);
    expect(result.get("smartcontractkit/bar")).toEqual(["feature/test"]);
  });

  it("handles whitespace correctly", () => {
    const input = `  smartcontractkit/.github  :   main  ,  develop
  smartcontractkit/foo  :  v1.0  `;
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(2);
    expect(result.get("smartcontractkit/.github")).toEqual(["main", "develop"]);
    expect(result.get("smartcontractkit/foo")).toEqual(["v1.0"]);
  });

  it("ignores empty lines", () => {
    const input = `smartcontractkit/.github: main

smartcontractkit/foo: develop

`;
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(2);
    expect(result.get("smartcontractkit/.github")).toEqual(["main"]);
    expect(result.get("smartcontractkit/foo")).toEqual(["develop"]);
  });

  it("appends branches to existing repo entries", () => {
    const input = `smartcontractkit/.github: main
smartcontractkit/.github: develop,feature/test`;
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(1);
    expect(result.get("smartcontractkit/.github")).toEqual([
      "main",
      "develop",
      "feature/test",
    ]);
  });

  it("filters out empty branches after splitting", () => {
    const input = "smartcontractkit/.github: main,,develop,";
    mockedCore.getInput.mockReturnValue(input);

    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");

    expect(result.size).toBe(1);
    expect(result.get("smartcontractkit/.github")).toEqual(["main", "develop"]);
  });

  it("ignores line when no branch is specified", () => {
    mockedCore.getInput.mockReturnValue("smartcontractkit/.github:");
    const result = getRunInputRepoBranchExceptions("repoBranchExceptions");
    expect(result.size).toBe(0);
  });

  it("throws error when repo name is missing", () => {
    mockedCore.getInput.mockReturnValue(": main");

    expect(() => {
      getRunInputRepoBranchExceptions("repoBranchExceptions");
    }).toThrow("Invalid repo in line: : main");
  });

  it("throws error when multiple colons are present", () => {
    mockedCore.getInput.mockReturnValue(
      "smartcontractkit/.github: main: develop",
    );
    expect(() => {
      getRunInputRepoBranchExceptions("repoBranchExceptions");
    }).toThrow(
      "Multiple colons found in line: smartcontractkit/.github: main: develop",
    );
  });

  it("throws error when line has no colon separator", () => {
    mockedCore.getInput.mockReturnValue("smartcontractkit/.github main");
    expect(() => {
      getRunInputRepoBranchExceptions("repoBranchExceptions");
    }).toThrow("No branch in line: smartcontractkit/.github main");
  });
});

describe("shaMatches", () => {
  it("returns true for exact 12-char match", () => {
    expect(shaMatches("abcdefabcdef", "abcdefabcdef")).toBe(true);
  });

  it("returns false for exact 12-char mismatch", () => {
    expect(shaMatches("abcdefabcdef", "111111111111")).toBe(false);
  });

  it("returns true when 40-char exception starts with the 12-char dep SHA", () => {
    expect(
      shaMatches("abcdefabcdef", "abcdefabcdef1234567890abcdefabcdef12345678"),
    ).toBe(true);
  });

  it("returns false when 40-char exception does not start with the dep SHA", () => {
    expect(
      shaMatches("abcdefabcdef", "111111111111abcdefabcdef1234567890abcdef"),
    ).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(shaMatches("abcdefabcdef", "ABCDEFABCDEF")).toBe(true);
    expect(shaMatches("ABCDEFABCDEF", "abcdefabcdef")).toBe(true);
  });

  it("returns false when depSha is empty", () => {
    expect(shaMatches("", "abcdefabcdef")).toBe(false);
  });

  it("returns false when exceptionSha is empty", () => {
    expect(shaMatches("abcdefabcdef", "")).toBe(false);
  });
});
