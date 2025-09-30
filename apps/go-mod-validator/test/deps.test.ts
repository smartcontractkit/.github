import { execSync } from "child_process";
import { getDeps, getVersionType } from "../src/deps";
import { describe, expect, it, vi, MockedObject } from "vitest";
import * as glob from "@actions/glob";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
vi.mock("@actions/core", async (importOriginal: any) => ({
  ...(await importOriginal(typeof import("@actions/core"))),
  setFailed: (msg: string) => {
    console.log(`setFailed (stub): ${msg}`);
  },
  error: (msg: string) => {
    console.log(`error (stub): ${msg}`);
  },
  warning: (msg: string) => {
    console.log(`warn (stub): ${msg}`);
  },
  info: (msg: string) => {
    console.log(`info (stub): ${msg}`);
  },
  debug: () => {
    // noop
  },
}));

const mockedExecSync = vi.mocked(execSync);
vi.mock("child_process");
const mockedGlob = vi.mocked(glob);
vi.mock("@actions/glob");
type MockedGlob = MockedObject<Awaited<ReturnType<typeof glob.create>>>;

describe("getDependenciesMap", () => {
  it("should return a map of <go.mod files: dependencies in json>", async () => {
    const paths = ["/path/to/first/go.mod", "/path/to/second/go.mod"];
    const goList1 =
      '{"Path": "github.com/smartcontractkit/go-plugin", "Version": "v0.0.0-20240208201424-b3b91517de16"}';
    const goList2 =
      '{"Path": "github.com/smartcontractkit/grpc-proxy", "Version": "v0.0.0-20230731113816-f1be6620749f"}';
    mockedGlob.create.mockResolvedValueOnce({
      glob: vi.fn().mockResolvedValue(paths),
    } as MockedGlob);

    mockedExecSync.mockImplementationOnce(() => goList1);
    mockedExecSync.mockImplementationOnce(() => goList2);

    const result = await getDeps("", "github.com/smartcontractkit");
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "commitSha": "b3b91517de16",
          "goModFilePath": "/path/to/first/go.mod",
          "name": "github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16",
          "owner": "smartcontractkit",
          "path": "github.com/smartcontractkit/go-plugin",
          "repo": "go-plugin",
          "version": "v0.0.0-20240208201424-b3b91517de16",
        },
        {
          "commitSha": "f1be6620749f",
          "goModFilePath": "/path/to/second/go.mod",
          "name": "github.com/smartcontractkit/grpc-proxy@v0.0.0-20230731113816-f1be6620749f",
          "owner": "smartcontractkit",
          "path": "github.com/smartcontractkit/grpc-proxy",
          "repo": "grpc-proxy",
          "version": "v0.0.0-20230731113816-f1be6620749f",
        },
      ]
    `);
  });

  it("should handle no go.mod files found", async () => {
    const paths: string[] = [];

    mockedGlob.create.mockResolvedValue({
      glob: vi.fn().mockResolvedValue(paths),
    } as MockedGlob);

    await expect(getDeps("", "")).rejects.toThrow("no go.mod files found");
  });

  it("should handle glob search failure", async () => {
    mockedGlob.create.mockRejectedValue(new Error("Glob error"));
    await expect(getDeps("", "")).rejects.toThrow("Glob error");
  });
});

// Mock data for tests
// https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo_test.go
// https://cs.opensource.google/go/x/mod/+/refs/tags/v0.20.0:module/pseudo.go;l=164
const pseudoTests = [
  { major: "", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v0", older: "", version: "v0.0.0-20060102150405-hash" },
  { major: "v1", older: "", version: "v1.0.0-20060102150405-hash" },
  { major: "v2", older: "", version: "v2.0.0-20060102150405-hash" },
  { major: "unused", older: "v0.0.0", version: "v0.0.1-0.20060102150405-hash" },
  { major: "unused", older: "v1.2.3", version: "v1.2.4-0.20060102150405-hash" },
  {
    major: "unused",
    older: "v1.2.99999999999999999",
    version: "v1.2.100000000000000000-0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.2.3-pre",
    version: "v1.2.3-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.3.0-pre",
    version: "v1.3.0-pre.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v0.0.0--",
    version: "v0.0.0--.0.20060102150405-hash",
  },
  {
    major: "unused",
    older: "v1.0.0+metadata",
    version: "v1.0.1-0.20060102150405-hash+metadata",
  },
  {
    major: "unused",
    older: "v2.0.0+incompatible",
    version: "v2.0.1-0.20060102150405-hash+incompatible",
  },
  {
    major: "unused",
    older: "v2.3.0-pre+incompatible",
    version: "v2.3.0-pre.0.20060102150405-hash+incompatible",
  },
];

describe("getVersionType", () => {
  for (const { version } of pseudoTests) {
    it(`should return the correct version type for ${version} `, () => {
      const verType = getVersionType(version);
      expect(verType).toEqual({ commitSha: "hash", tag: undefined });
    });
  }

  it("should parse out the git sha correctly", () => {
    let version = "v0.2.2-0.20240808143317-6b16fc28887d";
    let verType = getVersionType(version);
    expect(verType).toEqual({ commitSha: "6b16fc28887d", tag: undefined });

    version = "v0.0.1-beta-test.0.20240709043547-03612098f799";
    verType = getVersionType(version);
    expect(verType).toEqual({ commitSha: "03612098f799", tag: undefined });
  });

  it("should parse out the tag correctly", () => {
    const version = "v0.0.1";
    const verType = getVersionType(version);
    expect(verType).toEqual({ commitSha: undefined, tag: "v0.0.1" });
  });
});
