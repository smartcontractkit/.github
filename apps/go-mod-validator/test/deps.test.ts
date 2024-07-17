import { execSync } from "child_process";
import { getDependenciesMap } from "../src/deps";
import { describe, expect, it, vi } from "vitest";
import * as glob from "@actions/glob";

const mockedExecSync = vi.mocked(execSync);
vi.mock("child_process");
const mockedGlob = vi.mocked(glob);
vi.mock("@actions/glob");

describe("getDependenciesMap", () => {
  it("should return a map of <go.mod files: dependencies in json>", async () => {
    const paths = ["/path/to/first/go.mod", "/path/to/second/go.mod"];
    const goListMockOutput1 =
      '{"Path": "github.com/smartcontractkit/go-plugin", "Version": "v0.0.0-20240208201424-b3b91517de16"}';
    const goListMockOutput2 =
      '{"Path": "github.com/smartcontractkit/grpc-proxy", "Version": "v0.0.0-20230731113816-f1be6620749f"}';
    mockedGlob.create.mockResolvedValueOnce({
      glob: vi.fn().mockResolvedValue(paths),
      getSearchPaths: vi.fn(),
      globGenerator: vi.fn(),
    });

    mockedExecSync.mockImplementationOnce(() => goListMockOutput1);
    mockedExecSync.mockImplementationOnce(() => goListMockOutput2);

    const result = await getDependenciesMap("");
    expect(result).toEqual(
      new Map<string, any>([
        [paths[0], [JSON.parse(goListMockOutput1)]],
        [paths[1], [JSON.parse(goListMockOutput2)]],
      ]),
    );
  });

  it("should handle no go.mod files found", async () => {
    const paths: string[] = [];

    (glob.create as any).mockResolvedValue({
      glob: vi.fn().mockResolvedValue(paths),
    });

    await expect(getDependenciesMap("")).rejects.toThrow(
      "no go.mod files found",
    );
  });

  it("should handle `find` command failure", async () => {
    (glob.create as any).mockRejectedValue(new Error("Glob error"));
    await expect(getDependenciesMap("")).rejects.toThrow("Glob error");
  });
});
