import { createHash } from "node:crypto";
import * as fs from "node:fs";

export const RELEASE_OWNER = "smartcontractkit";
export const RELEASE_REPO = "pr-triage";

export type ReleaseArch = "amd64" | "arm64";

export interface ReleaseAssets {
  tag: string;
  bareVersion: string;
  arch: ReleaseArch;
  archiveName: string;
  checksumsName: string;
  archiveUrl: string;
  checksumsUrl: string;
}

// vX.Y.Z with an optional pre-release suffix; the same shape the pr-triage
// release workflow enforces on tags.
const VERSION_PATTERN =
  /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$/;

export function validateVersion(version: string): string {
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(
      `pr-triage: invalid release version '${version}' (expected a semver tag such as v0.1.0)`,
    );
  }
  return version;
}

export function assertLinux(runnerOs: string): void {
  if (runnerOs !== "Linux") {
    throw new Error(
      `pr-triage: unsupported runner OS '${runnerOs}' (only Linux runners are supported)`,
    );
  }
}

export function mapArch(runnerArch: string): ReleaseArch {
  switch (runnerArch) {
    case "X64":
      return "amd64";
    case "ARM64":
      return "arm64";
    default:
      throw new Error(
        `pr-triage: unsupported runner arch '${runnerArch}' (only X64 and ARM64 are supported)`,
      );
  }
}

function releaseUrl(tag: string, fileName: string): string {
  return (
    `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/` +
    `${tag}/${fileName}`
  );
}

export function resolveAssets(
  version: string,
  runnerOs: string,
  runnerArch: string,
): ReleaseAssets {
  const tag = validateVersion(version);
  assertLinux(runnerOs);
  const arch = mapArch(runnerArch);

  const bareVersion = tag.slice(1);
  const archiveName = `pr-triage_${bareVersion}_linux_${arch}.tar.gz`;
  const checksumsName = `pr-triage_${bareVersion}_checksums.txt`;

  return {
    tag,
    bareVersion,
    arch,
    archiveName,
    checksumsName,
    archiveUrl: releaseUrl(tag, archiveName),
    checksumsUrl: releaseUrl(tag, checksumsName),
  };
}

// goreleaser writes "<64-hex>  <filename>" per line. A line that names the
// requested file but does not carry a well-formed digest is an error of its
// own, so a corrupted checksums file never reads as a missing entry.
export function parseChecksum(checksumsText: string, fileName: string): string {
  let malformed = false;

  for (const line of checksumsText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }

    const match = /^([0-9a-fA-F]{64})\s+\*?(.+)$/.exec(trimmed);
    if (!match) {
      if (trimmed.split(/\s+/).includes(fileName)) {
        malformed = true;
      }
      continue;
    }

    if (match[2].trim() === fileName) {
      return match[1].toLowerCase();
    }
  }

  if (malformed) {
    throw new Error(
      `pr-triage: malformed checksum entry for '${fileName}' in checksums.txt`,
    );
  }
  throw new Error(
    `pr-triage: no checksum entry for '${fileName}' in checksums.txt`,
  );
}

export function verifySha256(filePath: string, expectedHex: string): void {
  const actualHex = createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");

  if (actualHex !== expectedHex.toLowerCase()) {
    throw new Error(
      `pr-triage: SHA-256 mismatch for '${filePath}' (expected ${expectedHex.toLowerCase()}, got ${actualHex})`,
    );
  }
}
