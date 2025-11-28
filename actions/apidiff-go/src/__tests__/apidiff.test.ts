import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execa } from "execa";

import { installApidiff, parseApidiffOutput } from "../apidiff.js";

// Mock @actions/core
vi.mock("@actions/core", () => ({
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  addPath: vi.fn(),
  setFailed: vi.fn(),
}));

describe("installApidiff", () => {
  let tempDir: string;
  let testGoModulesDir: string;
  let shouldSkipTest: boolean;

  beforeAll(async () => {
    // Check if Go is available for testing first
    try {
      await execa("which", ["go"], { stderr: "ignore", stdout: "ignore" });
    } catch {
      console.warn("Go not available, skipping apidiff tests");
      shouldSkipTest = true;
      return;
    }

    // Check if apidiff is available
    try {
      await execa("which", ["apidiff"], { stderr: "ignore", stdout: "ignore" });
      shouldSkipTest = false;
    } catch {
      // apidiff not available, attempt to install if in CI
      const isCIEnv =
        process.env.CI === "true" && process.env.GITHUB_ACTIONS === "true";
      if (!isCIEnv) {
        console.log("apidiff not available locally, tests will be skipped");
        shouldSkipTest = true;
        return;
      }

      console.log("Running in GitHub Actions CI, installing apidiff...");
      try {
        await installApidiff(process.cwd(), "latest");
        shouldSkipTest = false;

        // Add to current process PATH
        const goPath =
          process.env.GOPATH || path.join(process.env.HOME || "", "go");
        const goBin = path.join(goPath, "bin");
        process.env.PATH = `${goBin}:${process.env.PATH}`;
      } catch (error) {
        console.warn(`Failed to install apidiff in CI: ${error}`);
        shouldSkipTest = false;
      }
    }
  }, 60000); // 60 second timeout for installation

  beforeEach(async () => {
    // Create a temporary directory for our tests
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "apidiff-test-"),
    );

    // Get the path to our test Go modules
    testGoModulesDir = path.join(__dirname, "go");

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up the temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle apidiff installation properly", async (context) => {
    if (shouldSkipTest) {
      console.log("Skipping test - apidiff not available");
      return context.skip();
    }

    await installApidiff(process.cwd(), "latest");

    // In CI, it will install, so check for installation messages
    // Locally, if apidiff is already available, it will detect existing installation
    const infoMessages = (core.info as any).mock.calls.map(
      (call: any[]) => call[0],
    );

    // Should either detect existing installation OR successfully install
    const hasExistingMessage = infoMessages.some((msg: string) =>
      msg.includes("apidiff is already installed"),
    );
    const hasInstallationMessages =
      infoMessages.some((msg: string) =>
        msg.includes("Installing apidiff..."),
      ) &&
      infoMessages.some((msg: string) =>
        msg.includes("apidiff installed successfully"),
      );

    expect(hasExistingMessage || hasInstallationMessages).toBe(true);
  }, 30000); // 30 second timeout

  it("should throw an error if an invalid version is passed", async (context) => {
    await expect(
      installApidiff(process.cwd(), "invalid-version", true),
    ).rejects.toThrowError(/Failed to install apidiff:/);
  }, 30000); // 30 second timeout
});

describe("parseApidiffOutput", () => {
  const fixturesDir = path.join(__dirname, "__fixtures__");

  const fixtureFiles = fs.readdirSync(fixturesDir).filter((file) =>
    // tweak extension filter if your fixtures use another extension
    [".txt"].includes(path.extname(file)),
  );

  for (const file of fixtureFiles) {
    const fixturePath = path.join(fixturesDir, file);
    const rawOutput = fs.readFileSync(fixturePath, "utf8");

    // Use the basename (without extension) as the moduleName
    const moduleName = path.basename(file, path.extname(file));

    it(`parses API diff output fixture: ${file}`, () => {
      const result = parseApidiffOutput(moduleName, rawOutput);
      expect(result).toMatchSnapshot();
    });
  }
});

// TODO:
//   - generateExportAtRef
//   - diffExports
