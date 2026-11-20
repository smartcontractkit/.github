import { createHash } from "node:crypto";
import * as fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  setSecret: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@actions/exec", () => ({ exec: vi.fn() }));

vi.mock("@actions/github", () => ({ getOctokit: vi.fn() }));

vi.mock("@actions/tool-cache", () => ({
  downloadTool: vi.fn(),
  extractTar: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    chmodSync: vi.fn(),
    mkdtempSync: vi.fn(() => "/tmp/pr-triage-bin-run-test"),
  };
});

import {
  buildArgs,
  buildChildEnv,
  maskSecrets,
  readInputs,
  run,
  type ActionInputs,
} from "../run";

const DEFAULT_RELEASE = "v0.1.0";
const ARCHIVE_PATH = "/tmp/download/archive.tar.gz";
const CHECKSUMS_PATH = "/tmp/download/checksums.txt";
const BIN_PATH = "/tmp/pr-triage-bin-run-test/pr-triage";
const ARCHIVE_BYTES = Buffer.from("PR_TRIAGE_ARCHIVE");

const mockedGetInput = vi.mocked(core.getInput);
const mockedDownloadTool = vi.mocked(tc.downloadTool);
const mockedExtractTar = vi.mocked(tc.extractTar);
const mockedExec = vi.mocked(exec.exec);
const mockedGetOctokit = vi.mocked(github.getOctokit);
const mockedGetLatestRelease = vi.fn();
const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedMkdtempSync = vi.mocked(fs.mkdtempSync);

const readFileSyncMock = fs.readFileSync as unknown as {
  mockImplementation: (
    implementation: (file: unknown, encoding?: unknown) => string | Buffer,
  ) => void;
};

function assetNames(tag: string): { archive: string; checksums: string } {
  const bare = tag.slice(1);
  return {
    archive: `pr-triage_${bare}_linux_amd64.tar.gz`,
    checksums: `pr-triage_${bare}_checksums.txt`,
  };
}

const defaultAssets = assetNames(DEFAULT_RELEASE);
const publicArchiveUrl =
  `https://github.com/smartcontractkit/pr-triage/releases/download/` +
  `${DEFAULT_RELEASE}/${defaultAssets.archive}`;
const publicChecksumsUrl =
  `https://github.com/smartcontractkit/pr-triage/releases/download/` +
  `${DEFAULT_RELEASE}/${defaultAssets.checksums}`;

function setInputs(values: Record<string, string> = {}): void {
  mockedGetInput.mockImplementation((name: string) => values[name] ?? "");
}

function inputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return {
    version: "",
    githubToken: "github-secret",
    releaseToken: "",
    orgToken: "",
    dryRun: false,
    skipReviewerRequests: false,
    allowNonOrgReviewers: false,
    verbose: false,
    noAi: false,
    aiApiKey: "",
    aiBaseUrl: "",
    logLevel: "",
    ...overrides,
  };
}

function mockFilesWithChecksum(tag = DEFAULT_RELEASE): {
  archive: string;
  checksums: string;
} {
  const names = assetNames(tag);
  const digest = createHash("sha256").update(ARCHIVE_BYTES).digest("hex");

  readFileSyncMock.mockImplementation((file) => {
    if (file === CHECKSUMS_PATH) {
      return `${digest}  ${names.archive}\n`;
    }
    if (file === ARCHIVE_PATH) {
      return ARCHIVE_BYTES;
    }
    throw new Error(`unexpected read of ${String(file)}`);
  });

  return names;
}

function usePublicDownloads(tag = DEFAULT_RELEASE): {
  archive: string;
  checksums: string;
} {
  const names = mockFilesWithChecksum(tag);
  mockedDownloadTool.mockImplementation(async (url: string) =>
    url.endsWith(".tar.gz") ? ARCHIVE_PATH : CHECKSUMS_PATH,
  );
  return names;
}

function useAuthenticatedDownloads(tag = DEFAULT_RELEASE): {
  getLatestRelease: ReturnType<typeof vi.fn>;
  getReleaseByTag: ReturnType<typeof vi.fn>;
  archiveApiUrl: string;
  checksumsApiUrl: string;
} {
  const names = mockFilesWithChecksum(tag);
  const archiveApiUrl = "https://api.github.com/assets/archive";
  const checksumsApiUrl = "https://api.github.com/assets/checksums";

  const getLatestRelease = vi
    .fn()
    .mockResolvedValue({ data: { tag_name: tag } });
  const getReleaseByTag = vi.fn().mockResolvedValue({
    data: {
      assets: [
        { name: names.archive, url: archiveApiUrl },
        { name: names.checksums, url: checksumsApiUrl },
      ],
    },
  });

  mockedGetOctokit.mockReturnValue({
    rest: { repos: { getLatestRelease, getReleaseByTag } },
  } as unknown as ReturnType<typeof github.getOctokit>);

  mockedDownloadTool.mockImplementation(async (url: string) =>
    url === archiveApiUrl ? ARCHIVE_PATH : CHECKSUMS_PATH,
  );

  return {
    getLatestRelease,
    getReleaseByTag,
    archiveApiUrl,
    checksumsApiUrl,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  process.env.RUNNER_OS = "Linux";
  process.env.RUNNER_ARCH = "X64";
  process.env.RUNNER_TEMP = "/tmp";

  mockedExistsSync.mockReturnValue(true);
  mockedMkdtempSync.mockReturnValue("/tmp/pr-triage-bin-run-test");
  mockedExtractTar.mockResolvedValue("/tmp/pr-triage-bin-run-test");
  mockedExec.mockResolvedValue(0);

  mockedGetLatestRelease.mockResolvedValue({
    data: { tag_name: DEFAULT_RELEASE },
  });
  mockedGetOctokit.mockReturnValue({
    rest: { repos: { getLatestRelease: mockedGetLatestRelease } },
  } as unknown as ReturnType<typeof github.getOctokit>);

  setInputs();
});

afterEach(() => {
  delete process.env["INPUT_RELEASE-TOKEN"];
});

describe("readInputs", () => {
  it("leaves the version empty so the latest release is used", () => {
    setInputs();
    expect(readInputs().version).toBe("");
  });

  it("uses the version input when given", () => {
    setInputs({ version: "v1.2.3" });
    expect(readInputs().version).toBe("v1.2.3");
  });

  it("treats only an exact 'true' as a boolean flag", () => {
    setInputs({ "dry-run": "true", verbose: "yes" });
    const parsed = readInputs();
    expect(parsed.dryRun).toBe(true);
    expect(parsed.verbose).toBe(false);
  });
});

describe("maskSecrets", () => {
  it("masks every secret input", () => {
    maskSecrets(
      inputs({
        githubToken: "github-secret",
        releaseToken: "release-secret",
        orgToken: "org-secret",
        aiApiKey: "ai-secret",
      }),
    );

    expect(
      vi.mocked(core.setSecret).mock.calls.map(([value]) => value),
    ).toEqual(["github-secret", "release-secret", "org-secret", "ai-secret"]);
  });

  it("skips empty secrets", () => {
    maskSecrets(inputs({ githubToken: "", releaseToken: "", orgToken: "" }));
    expect(core.setSecret).not.toHaveBeenCalled();
  });
});

describe("buildArgs", () => {
  it("passes no flags by default", () => {
    expect(buildArgs(inputs())).toEqual(["analyze"]);
  });

  it("forwards every flag", () => {
    expect(
      buildArgs(
        inputs({
          dryRun: true,
          skipReviewerRequests: true,
          allowNonOrgReviewers: true,
          verbose: true,
          noAi: true,
          logLevel: "debug",
        }),
      ),
    ).toEqual([
      "analyze",
      "--dry-run",
      "--skip-reviewer-requests",
      "--allow-non-org-reviewers",
      "--verbose",
      "--no-ai",
      "--log-level",
      "debug",
    ]);
  });
});

describe("buildChildEnv", () => {
  const base = {
    PATH: "/usr/bin",
    GITHUB_TOKEN: "ambient-token",
    PR_TRIAGE_ORG_TOKEN: "ambient-org-token",
    PR_TRIAGE_AI_API_KEY: "ambient-ai-key",
    "INPUT_RELEASE-TOKEN": "release-secret",
  };

  it("sets the token inputs pr-triage reads", () => {
    const env = buildChildEnv(
      inputs({
        githubToken: "github-secret",
        orgToken: "org-secret",
        aiApiKey: "ai-secret",
        aiBaseUrl: "https://ai.example.com",
      }),
      base,
    );

    expect(env.GITHUB_TOKEN).toBe("github-secret");
    expect(env.PR_TRIAGE_ORG_TOKEN).toBe("org-secret");
    expect(env.PR_TRIAGE_AI_API_KEY).toBe("ai-secret");
    expect(env.PR_TRIAGE_AI_BASE_URL).toBe("https://ai.example.com");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("deletes optional variables when their inputs are empty", () => {
    const env = buildChildEnv(inputs(), base);

    expect(env).not.toHaveProperty("PR_TRIAGE_ORG_TOKEN");
    expect(env).not.toHaveProperty("PR_TRIAGE_AI_API_KEY");
    expect(env).not.toHaveProperty("PR_TRIAGE_AI_BASE_URL");
  });

  it("keeps the release input copy out of the child environment", () => {
    const env = buildChildEnv(inputs({ releaseToken: "release-secret" }), base);

    expect(env).not.toHaveProperty("INPUT_RELEASE-TOKEN");
    expect(JSON.stringify(env)).not.toContain("release-secret");
  });
});

describe("run", () => {
  it("resolves the latest release and downloads the public URLs when release-token is empty", async () => {
    setInputs({ "github-token": "github-secret" });
    usePublicDownloads();

    await run();

    expect(mockedGetOctokit).toHaveBeenCalledWith("github-secret");
    expect(mockedGetLatestRelease).toHaveBeenCalledWith({
      owner: "smartcontractkit",
      repo: "pr-triage",
    });
    expect(mockedDownloadTool).toHaveBeenCalledWith(publicArchiveUrl);
    expect(mockedDownloadTool).toHaveBeenCalledWith(publicChecksumsUrl);
    expect(mockedExtractTar).toHaveBeenCalledWith(
      ARCHIVE_PATH,
      expect.any(String),
    );
    expect(mockedExec).toHaveBeenCalledWith(BIN_PATH, ["analyze"], {
      env: expect.objectContaining({ GITHUB_TOKEN: "github-secret" }),
    });
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("resolves and downloads release assets with the release token", async () => {
    setInputs({
      "github-token": "github-secret",
      "release-token": "release-secret",
    });
    const {
      getLatestRelease,
      getReleaseByTag,
      archiveApiUrl,
      checksumsApiUrl,
    } = useAuthenticatedDownloads();

    await run();

    expect(mockedGetOctokit).toHaveBeenCalledWith("release-secret");
    expect(getLatestRelease).toHaveBeenCalledWith({
      owner: "smartcontractkit",
      repo: "pr-triage",
    });
    expect(getReleaseByTag).toHaveBeenCalledWith({
      owner: "smartcontractkit",
      repo: "pr-triage",
      tag: DEFAULT_RELEASE,
    });
    expect(mockedDownloadTool).toHaveBeenCalledWith(
      archiveApiUrl,
      undefined,
      "Bearer release-secret",
      { accept: "application/octet-stream" },
    );
    expect(mockedDownloadTool).toHaveBeenCalledWith(
      checksumsApiUrl,
      undefined,
      "Bearer release-secret",
      { accept: "application/octet-stream" },
    );
    expect(mockedDownloadTool).not.toHaveBeenCalledWith(publicArchiveUrl);
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it("installs the version from the version input", async () => {
    setInputs({ version: "v1.2.3" });
    const names = usePublicDownloads("v1.2.3");

    await run();

    expect(mockedGetLatestRelease).not.toHaveBeenCalled();
    expect(mockedDownloadTool).toHaveBeenCalledWith(
      `https://github.com/smartcontractkit/pr-triage/releases/download/v1.2.3/${names.archive}`,
    );
  });

  it("fails with the required permission when the pinned release cannot be read", async () => {
    setInputs({
      version: DEFAULT_RELEASE,
      "release-token": "release-secret",
    });
    const getReleaseByTag = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { status: 404 }),
      );
    mockedGetOctokit.mockReturnValue({
      rest: { repos: { getReleaseByTag } },
    } as unknown as ReturnType<typeof github.getOctokit>);

    await run();

    const failed = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(failed).toContain("smartcontractkit/pr-triage");
    expect(failed).toContain(DEFAULT_RELEASE);
    expect(failed).toContain("contents: read");
    expect(failed).toContain("HTTP 404");
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("fails with the required permission when the latest release cannot be read", async () => {
    setInputs({ "release-token": "release-secret" });
    const getLatestRelease = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Not Found"), { status: 404 }),
      );
    mockedGetOctokit.mockReturnValue({
      rest: { repos: { getLatestRelease } },
    } as unknown as ReturnType<typeof github.getOctokit>);

    await run();

    const failed = vi.mocked(core.setFailed).mock.calls[0][0] as string;
    expect(failed).toContain("latest smartcontractkit/pr-triage release");
    expect(failed).toContain("contents: read");
    expect(failed).toContain("HTTP 404");
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("fails the action when the CLI exits non-zero", async () => {
    usePublicDownloads();
    mockedExec.mockRejectedValue(new Error("pr-triage analyze exited 1"));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith("pr-triage analyze exited 1");
  });

  it("fails the action when the checksum does not match", async () => {
    usePublicDownloads();
    readFileSyncMock.mockImplementation((file) => {
      if (file === CHECKSUMS_PATH) {
        return `${"a".repeat(64)}  ${defaultAssets.archive}\n`;
      }
      return ARCHIVE_BYTES;
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("SHA-256 mismatch"),
    );
    expect(mockedExtractTar).not.toHaveBeenCalled();
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("keeps every secret out of the child environment and masks it in logs", async () => {
    setInputs({
      "github-token": "github-secret",
      "release-token": "release-secret",
      "org-token": "org-secret",
      "ai-api-key": "ai-secret",
    });
    process.env["INPUT_RELEASE-TOKEN"] = "release-secret";
    useAuthenticatedDownloads();

    await run();

    expect(
      vi.mocked(core.setSecret).mock.calls.map(([value]) => value),
    ).toEqual(["github-secret", "release-secret", "org-secret", "ai-secret"]);

    const env = mockedExec.mock.calls[0][2]?.env ?? {};
    expect(JSON.stringify(env)).not.toContain("release-secret");
    expect(env.PR_TRIAGE_ORG_TOKEN).toBe("org-secret");
    expect(env.PR_TRIAGE_AI_API_KEY).toBe("ai-secret");
  });

  it("fails when the archive does not contain the binary", async () => {
    usePublicDownloads();
    mockedExistsSync.mockReturnValue(false);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("did not contain a 'pr-triage' binary"),
    );
    expect(mockedExec).not.toHaveBeenCalled();
  });
});
