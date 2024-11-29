// index.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import * as core from "@actions/core";
import * as fs from "fs";
import * as stream from "stream";

import { hashFile, comparePackagesToIndex } from "../../src/pipeline/hash.js";
import type { HashedCompiledPackages } from "../../src/pipeline.js";

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

  it("should run new packages not present in hashIndex", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/new": createPackageEntry("abc123"),
    };

    const hashIndex = {
      "package/old": "def456",
    };

    // Act
    const result = comparePackagesToIndex(false, packages, hashIndex);

    // Assert
    expect(result["package/new"].hash).toBe("abc123");
    expect(result["package/new"].indexHash).toBeUndefined();
    expect(result["package/new"].shouldRun).toBe(true);
  });

  it("should run packages with changed hash", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/changed": createPackageEntry("hashNew"),
    };

    const hashIndex = {
      "package/changed": "hashOld",
    };

    // Act
    const result = comparePackagesToIndex(false, packages, hashIndex);

    // Assert
    expect(result["package/changed"].hash).toBe("hashNew");
    expect(result["package/changed"].indexHash).toBe("hashOld");
    expect(result["package/changed"].shouldRun).toBe(true);
  });

  it("should not run packages with unchanged hash", () => {
    // Arrange
    const packages: HashedCompiledPackages = {
      "package/unchanged": createPackageEntry("hashSame"),
    };

    const hashIndex = {
      "package/unchanged": "hashSame",
    };

    // Act
    const result = comparePackagesToIndex(false, packages, hashIndex);

    // Assert
    expect(result["package/unchanged"].hash).toBe("hashSame");
    expect(result["package/unchanged"].indexHash).toBe("hashSame");
    expect(result["package/unchanged"].shouldRun).toBe(false);
  });

  it("should run new and changed packages, and not run unchanged ones", () => {
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
    // Act
    const result = comparePackagesToIndex(false, packages, hashIndex);

    // Assert
    expect(result["package/new"].hash).toBe("hashNew");
    expect(result["package/new"].indexHash).toBeUndefined();
    expect(result["package/new"].shouldRun).toBe(true);

    expect(result["package/changed"].hash).toBe("hashChangedNew");
    expect(result["package/changed"].indexHash).toBe("hashChangedOld");
    expect(result["package/changed"].shouldRun).toBe(true);

    expect(result["package/unchanged"].hash).toBe("hashSame");
    expect(result["package/unchanged"].indexHash).toBe("hashSame");
    expect(result["package/unchanged"].shouldRun).toBe(false);
  });

  it("should run all packages when run-all-tests is true", () => {
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
    // Act
    const result = comparePackagesToIndex(true, packages, hashIndex);

    // Assert
    expect(result["package/new"].hash).toBe("hashNew");
    expect(result["package/new"].indexHash).toBeUndefined();
    expect(result["package/new"].shouldRun).toBe(true);

    expect(result["package/changed"].hash).toBe("hashChangedNew");
    expect(result["package/changed"].indexHash).toBe("hashChangedOld");
    expect(result["package/changed"].shouldRun).toBe(true);

    expect(result["package/unchanged"].hash).toBe("hashSame");
    expect(result["package/unchanged"].indexHash).toBe("hashSame");
    expect(result["package/unchanged"].shouldRun).toBe(true);
  });
});

function createPackageEntry(
  hash: string,
): HashedCompiledPackages[keyof HashedCompiledPackages] {
  return {
    importPath: "foo.com/bar/baz/v2/qux",
    directory: "baz/qux",
    compile: { binary: "", log: "", execution: null as any },
    hash,
  };
}
