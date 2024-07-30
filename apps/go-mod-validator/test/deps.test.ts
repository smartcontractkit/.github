import { execSync } from "child_process";
import { getDeps } from "../src/deps";
import { describe, expect, it, vi, MockedObject } from "vitest";
import * as glob from "@actions/glob";

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
          "goModFilePath": "/path/to/first/go.mod",
          "name": "github.com/smartcontractkit/go-plugin@v0.0.0-20240208201424-b3b91517de16",
          "path": "github.com/smartcontractkit/go-plugin",
          "version": "v0.0.0-20240208201424-b3b91517de16",
        },
        {
          "goModFilePath": "/path/to/second/go.mod",
          "name": "github.com/smartcontractkit/grpc-proxy@v0.0.0-20230731113816-f1be6620749f",
          "path": "github.com/smartcontractkit/grpc-proxy",
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
