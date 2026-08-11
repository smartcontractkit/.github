import { vi, describe, test, expect } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

let execFileResponses: Record<string, { stdout?: string; stderr?: string }> =
  {};
let execFileSequence: {
  command: string;
  args: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}[] = [];

vi.mock("child_process", () => ({
  execFile: vi.fn(
    (
      cmd: string,
      args: string[],
      options: unknown,
      callback: (
        err: Error | null,
        result?: { stdout: string; stderr: string },
      ) => void,
    ) => {
      const fullCommand = `${cmd} ${args.join(" ")}`;

      const match = execFileResponses[fullCommand];
      if (match) {
        callback(null, {
          stdout: match.stdout ?? "",
          stderr: match.stderr ?? "",
        });
        return {} as any;
      }

      const seqMatch = execFileSequence.find(
        (s) => s.command === cmd && s.args.join(" ") === args.join(" "),
      );
      if (seqMatch) {
        if (seqMatch.exitCode !== undefined && seqMatch.exitCode !== 0) {
          const err = new Error(
            seqMatch.stderr ?? "exit code " + seqMatch.exitCode,
          );
          (err as any).code = seqMatch.exitCode;
          callback(err);
        } else {
          callback(null, {
            stdout: seqMatch.stdout ?? "",
            stderr: seqMatch.stderr ?? "",
          });
        }
        return {} as any;
      }

      callback(new Error(`Unexpected execFile call: ${fullCommand}`));
      return {} as any;
    },
  ),
}));

import { getChangedFilesGit } from "../git";

function setExecFileResponse(
  command: string,
  args: string[],
  stdout: string,
  exitCode: number = 0,
) {
  const fullCommand = `${command} ${args.join(" ")}`;
  execFileResponses[fullCommand] = { stdout };
}

function clearExecFileResponses() {
  execFileResponses = {};
  execFileSequence = [];
}

// ---------------------------------------------------------------------------
// getChangedFilesGit
// ---------------------------------------------------------------------------

describe("getChangedFilesGit", () => {
  test("returns changed files when both refs resolve", async () => {
    clearExecFileResponses();
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "base-sha^{commit}"],
      "base-sha\n",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "head-sha^{commit}"],
      "head-sha\n",
    );
    setExecFileResponse(
      "git",
      ["diff", "--name-only", "base-sha", "head-sha"],
      "src/foo.ts\nsrc/bar.ts\n",
    );

    const files = await getChangedFilesGit("base-sha", "head-sha", "/repo");

    expect(files).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  test("fetches missing refs when token provided", async () => {
    clearExecFileResponses();
    // First resolution attempt fails for both refs.
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "base-sha^{commit}"],
      "",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "head-sha^{commit}"],
      "",
    );
    // Fetch succeeds.
    setExecFileResponse(
      "git",
      [
        "-c",
        "http.extraheader=AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46dG9rZW4=",
        "fetch",
        "origin",
        "--depth=1",
        "base-sha",
        "head-sha",
      ],
      "",
    );
    // Resolution succeeds after fetch.
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "base-sha^{commit}"],
      "base-sha\n",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "head-sha^{commit}"],
      "head-sha\n",
    );
    setExecFileResponse(
      "git",
      ["diff", "--name-only", "base-sha", "head-sha"],
      "src/foo.ts\n",
    );

    const files = await getChangedFilesGit(
      "base-sha",
      "head-sha",
      "/repo",
      "token",
    );

    expect(files).toEqual(["src/foo.ts"]);
  });

  test("throws when refs remain unresolved after fetch", async () => {
    clearExecFileResponses();
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "base-sha^{commit}"],
      "",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "head-sha^{commit}"],
      "",
    );
    setExecFileResponse(
      "git",
      [
        "-c",
        "http.extraheader=AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46dG9rZW4=",
        "fetch",
        "origin",
        "--depth=1",
        "base-sha",
        "head-sha",
      ],
      "",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "base-sha^{commit}"],
      "",
    );
    setExecFileResponse(
      "git",
      ["rev-parse", "-q", "--verify", "head-sha^{commit}"],
      "",
    );

    await expect(
      getChangedFilesGit("base-sha", "head-sha", "/repo", "token"),
    ).rejects.toThrow("One or both git references could not be resolved");
  });
});
