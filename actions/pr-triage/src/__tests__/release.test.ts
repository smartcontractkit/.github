import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  mapArch,
  parseChecksum,
  resolveAssets,
  validateVersion,
  verifySha256,
} from "../release";

describe("validateVersion", () => {
  it("accepts semver tags", () => {
    expect(validateVersion("v0.1.0")).toBe("v0.1.0");
    expect(validateVersion("v1.2.3")).toBe("v1.2.3");
    expect(validateVersion("v10.20.30-rc.1")).toBe("v10.20.30-rc.1");
  });

  it("rejects a bare version", () => {
    expect(() => validateVersion("0.1.0")).toThrow("invalid release version");
  });

  it("rejects a partial version", () => {
    expect(() => validateVersion("v1.2")).toThrow("invalid release version");
  });

  it("rejects leading zeros", () => {
    expect(() => validateVersion("v01.2.3")).toThrow("invalid release version");
  });

  it("rejects a version with build metadata", () => {
    expect(() => validateVersion("v1.2.3+build.5")).toThrow(
      "invalid release version",
    );
  });

  it("rejects an arbitrary ref", () => {
    expect(() => validateVersion("latest")).toThrow("invalid release version");
  });
});

describe("mapArch", () => {
  it("maps X64 to amd64", () => {
    expect(mapArch("X64")).toBe("amd64");
  });

  it("maps ARM64 to arm64", () => {
    expect(mapArch("ARM64")).toBe("arm64");
  });

  it("rejects an unsupported arch", () => {
    expect(() => mapArch("X86")).toThrow("unsupported runner arch");
  });

  it("rejects an empty arch", () => {
    expect(() => mapArch("")).toThrow("unsupported runner arch");
  });
});

describe("resolveAssets", () => {
  it("builds linux amd64 asset names and public URLs", () => {
    expect(resolveAssets("v0.1.0", "Linux", "X64")).toEqual({
      tag: "v0.1.0",
      bareVersion: "0.1.0",
      arch: "amd64",
      archiveName: "pr-triage_0.1.0_linux_amd64.tar.gz",
      checksumsName: "pr-triage_0.1.0_checksums.txt",
      archiveUrl:
        "https://github.com/smartcontractkit/pr-triage/releases/download/v0.1.0/pr-triage_0.1.0_linux_amd64.tar.gz",
      checksumsUrl:
        "https://github.com/smartcontractkit/pr-triage/releases/download/v0.1.0/pr-triage_0.1.0_checksums.txt",
    });
  });

  it("builds linux arm64 asset names", () => {
    const assets = resolveAssets("v1.2.3", "Linux", "ARM64");
    expect(assets.arch).toBe("arm64");
    expect(assets.archiveName).toBe("pr-triage_1.2.3_linux_arm64.tar.gz");
  });

  it("keeps the pre-release suffix in the tag but not the asset version", () => {
    const assets = resolveAssets("v1.2.3-rc.1", "Linux", "X64");
    expect(assets.tag).toBe("v1.2.3-rc.1");
    expect(assets.bareVersion).toBe("1.2.3-rc.1");
    expect(assets.archiveName).toBe("pr-triage_1.2.3-rc.1_linux_amd64.tar.gz");
  });

  it("rejects macOS", () => {
    expect(() => resolveAssets("v0.1.0", "macOS", "X64")).toThrow(
      "unsupported runner OS",
    );
  });

  it("rejects Windows", () => {
    expect(() => resolveAssets("v0.1.0", "Windows", "X64")).toThrow(
      "unsupported runner OS",
    );
  });

  it("rejects an invalid version before mapping the platform", () => {
    expect(() => resolveAssets("main", "Linux", "X64")).toThrow(
      "invalid release version",
    );
  });
});

describe("parseChecksum", () => {
  const archive = "pr-triage_0.1.0_linux_amd64.tar.gz";
  const digest =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("returns the digest for the requested file", () => {
    const text = [
      `${digest}  pr-triage_0.1.0_checksums.txt`,
      `${digest}  ${archive}`,
      `${"f".repeat(64)}  pr-triage_0.1.0_linux_arm64.tar.gz`,
      "",
    ].join("\n");

    expect(parseChecksum(text, archive)).toBe(digest);
  });

  it("lowercases an uppercase digest", () => {
    expect(
      parseChecksum(`${digest.toUpperCase()}  ${archive}\n`, archive),
    ).toBe(digest);
  });

  it("handles CRLF line endings", () => {
    expect(parseChecksum(`${digest}  ${archive}\r\n`, archive)).toBe(digest);
  });

  it("throws when the file is missing", () => {
    expect(() =>
      parseChecksum(`${digest}  pr-triage_0.1.0_linux_arm64.tar.gz\n`, archive),
    ).toThrow("no checksum entry");
  });

  it("throws on a malformed digest", () => {
    expect(() => parseChecksum(`not-a-digest  ${archive}\n`, archive)).toThrow(
      "malformed checksum entry",
    );
  });

  it("throws on a short digest", () => {
    expect(() => parseChecksum(`abc123  ${archive}\n`, archive)).toThrow(
      "malformed checksum entry",
    );
  });

  it("throws on an empty checksums file", () => {
    expect(() => parseChecksum("", archive)).toThrow("no checksum entry");
  });
});

describe("verifySha256", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-triage-release-test-"));
  const filePath = path.join(dir, "archive.tar.gz");
  const contents = Buffer.from("PR_TRIAGE_ARCHIVE");
  const digest = createHash("sha256").update(contents).digest("hex");

  fs.writeFileSync(filePath, contents);

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a matching digest", () => {
    expect(() => verifySha256(filePath, digest)).not.toThrow();
  });

  it("accepts an uppercase digest", () => {
    expect(() => verifySha256(filePath, digest.toUpperCase())).not.toThrow();
  });

  it("rejects a mismatched digest with both values", () => {
    const other = "f".repeat(64);
    expect(() => verifySha256(filePath, other)).toThrow(
      `expected ${other}, got ${digest}`,
    );
  });
});
