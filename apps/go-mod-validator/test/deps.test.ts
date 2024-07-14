import { execSync } from "child_process";
import { getDependenciesMap } from "../src/deps";
import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

vi.mock("child_process");

describe("getDependenciesMap", () => {
  it("should return a map of <go.mod files: dependencies in json>", async () => {
    const paths = ["/path/to/first/go.mod", "/path/to/second/go.mod"];
    const goListMockOutput1 =
      '[{"Path": "github.com/smartcontractkit/go-plugin", "Version": "v0.0.0-20240208201424-b3b91517de16"}]';
    const goListMockOutput2 =
      '[{"Path": "github.com/smartcontractkit/grpc-proxy", "Version": "v0.0.0-20230731113816-f1be6620749f"}]';

    let callCount = 0;
    (execSync as Mock).mockImplementation((command) => {
      if (command.includes("go list")) {
        callCount++;
        return callCount === 1 ? goListMockOutput1 : goListMockOutput2;
      } else if (command.includes("find")) {
        return paths.join("\n");
      }
      return "";
    });

    const result = await getDependenciesMap("");
    expect(result).toEqual(
      new Map<string, any>([
        [paths[0], JSON.parse(goListMockOutput1)],
        [paths[1], JSON.parse(goListMockOutput2)],
      ]),
    );
  });

  it("should handle no go.mod files found", async () => {
    const paths: string[] = [];

    (execSync as Mock).mockImplementation((command) => {
      return paths.join("\n");
    });

    expect(async () => await getDependenciesMap("")).toThrow(
      "no go.mod files found",
    );
  });

  it("should handle `go list` command failure", () => {
    const paths: string[] = ["/path/to/first/go.mod"];
    const error = new Error("Command failed");

    (execSync as Mock).mockImplementation((command) => {
      if (command.includes("go list")) {
        throw error;
      } else if (command.includes("find")) {
        return paths.join("\n");
      }
    });

    expect(async () => await getDependenciesMap("")).toThrow(
      `failed to get go.mod dependencies from file: ${paths[0]}: ${error}`,
    );
  });

  it("should handle `find` command failure", () => {
    const error = new Error("Command failed");

    (execSync as Mock).mockImplementation((command) => {
      if (command.includes("find")) {
        throw error;
      }
    });

    expect(async () => await getDependenciesMap("")).toThrow(
      `failed to get go.mod files: ${error}`,
    );
  });
});
