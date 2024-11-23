// index.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import * as core from "@actions/core";
import * as fs from "fs";
import * as stream from "stream";

import { hashFile, comparePackagesToIndex } from "../../src/pipeline/hash.js";
import type { HashedCompiledPackages } from "../../src/pipeline/index.js";

// Mock modules
vi.mock("fs");
vi.mock("../github.js", () => ({
  getHashFile: vi.fn(),
}));

// Unmock stream/promises to use the real pipeline function
vi.unmock("stream/promises");

describe("hashFile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should compute the SHA256 hash of the file content", async () => {
    // Arrange
    const testFilePath = "/path/to/test/file.txt";
    const fileContent = "Hello, world!";

    // Mock createReadStream to return a stream that outputs fileContent
    const readableStream = new stream.Readable({
      read() {
        this.push(fileContent);
        this.push(null);
      },
    });

    vi.spyOn(fs, "createReadStream").mockReturnValue(readableStream as any);

    // Act
    const hash = await hashFile(testFilePath);

    // Compute expected hash
    const expectedHash = createHash("sha256").update(fileContent).digest("hex");

    // Assert
    expect(hash).toBe(expectedHash);
  });
});

describe("comparePackagesToIndex", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should include new packages not present in hashIndex", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/new": createPackageEntry("abc123"),
    };

    const hashIndex = {
      "package/old": "def456",
    };

    // Act
    const result = comparePackagesToIndex(packages, hashIndex);

    // Assert
    expect(result).toHaveProperty("package/new");
    expect(Object.keys(result)).toHaveLength(1);
  });

  it("should include packages with changed hash", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/changed": createPackageEntry("hashNew")
    };

    const hashIndex = {
      "package/changed": "hashOld",
    };

    // Act
    const result = comparePackagesToIndex(packages, hashIndex);

    // Assert
    expect(result).toHaveProperty("package/changed");
    expect(Object.keys(result)).toHaveLength(1);
  });

  it("should not include packages with unchanged hash", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/unchanged": createPackageEntry("hashSame")
    };

    const hashIndex = {
      "package/unchanged": "hashSame",
    };

    // Act
    const result = comparePackagesToIndex(packages, hashIndex);

    // Assert
    expect(result).not.toHaveProperty("package/unchanged");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should include new and changed packages, and exclude unchanged ones", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/new": createPackageEntry("hashNew"),
      "package/changed": createPackageEntry("hashChangedNew"),
      "package/unchanged": createPackageEntry("hashSame"),
    };

    const hashIndex = {
      "package/changed": "hashChangedOld",
      "package/unchanged": "hashSame",
      "package/deleted": "hashDeleted",
    };

    const debugSpy = vi.spyOn(core, "debug");
    vi.spyOn(core, "isDebug").mockReturnValue(true);

    // Act
    const result = comparePackagesToIndex(packages, hashIndex);

    // Assert
    expect(result).toHaveProperty("package/new");
    expect(result).toHaveProperty("package/changed");
    expect(result).not.toHaveProperty("package/unchanged");
    expect(Object.keys(result)).toHaveLength(2);

    expect(debugSpy).toHaveBeenCalledWith("Found new test package package/new");
    expect(debugSpy).toHaveBeenCalledWith(
      "Found change in package/changed (hashChangedOld -> hashChangedNew)",
    );
    expect(debugSpy).toHaveBeenCalledWith(
      "Skipping package/unchanged - no changes",
    );
    expect(debugSpy).toHaveBeenCalledWith(
      "Found deleted test package package/deleted",
    );
  });
});

function createPackageEntry(hash: string): HashedCompiledPackages[keyof HashedCompiledPackages] {
  return {
    importPath: "foo.com/bar/baz/v2/qux",
    directory: "baz/qux",
    compile: { binary: "", log: "", execution: null as any },
    hash,
  };
}
