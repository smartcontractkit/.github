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

import { getGoModuleName } from "../util.js";

// Helper function to copy directory contents
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });

  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

describe("getModuleName", () => {
  let tempDir: string;
  let testGoModulesDir: string;
  let shouldRunTest: boolean;

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

  it("should extract module name from go.mod file", async (context) => {
    const sourceDir = path.join(testGoModulesDir, "no-changes");
    await copyDirectory(sourceDir, tempDir);

    const moduleName = await getGoModuleName(tempDir);
    expect(moduleName).toBe("github.com/example/no-changes");
  });
});
