import * as core from "@actions/core";
import * as github from "@actions/github";
import * as tc from "@actions/tool-cache";

import * as fs from "node:fs";
import * as path from "node:path";

import {
  RELEASE_OWNER,
  RELEASE_REPO,
  parseChecksum,
  resolveAssets,
  validateVersion,
  verifySha256,
  type ReleaseAssets,
} from "./release";

export const BIN_NAME = "pr-triage";

const ASSET_ACCEPT = "application/octet-stream";

export interface InstallOptions {
  version: string;
  githubToken: string;
  releaseToken: string;
}

export interface DownloadedRelease {
  archivePath: string;
  checksumsPath: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The release API hides a missing repository, a missing tag, and an
// unreadable one behind the same 404. Name the token permission so the
// operator knows which input to fix.
function releaseLookupError(tag: string, error: unknown): Error {
  const status = (error as { status?: number }).status;
  const suffix = status ? ` (HTTP ${status})` : "";
  return new Error(
    `pr-triage: could not read the ${RELEASE_OWNER}/${RELEASE_REPO} release ` +
      `'${tag}'${suffix}. The release token needs 'contents: read' on ` +
      `${RELEASE_OWNER}/${RELEASE_REPO}. Cause: ${errorMessage(error)}`,
  );
}

function latestReleaseError(error: unknown): Error {
  const status = (error as { status?: number }).status;
  const suffix = status ? ` (HTTP ${status})` : "";
  return new Error(
    `pr-triage: could not read the latest ${RELEASE_OWNER}/${RELEASE_REPO} ` +
      `release${suffix}. The release token needs 'contents: read' on ` +
      `${RELEASE_OWNER}/${RELEASE_REPO}. Cause: ${errorMessage(error)}`,
  );
}

// The newest published release, which excludes drafts and pre-releases. Pin a
// release with the `version` input when the caller needs a fixed binary.
export async function latestReleaseTag(token: string): Promise<string> {
  let release;
  try {
    const octokit = github.getOctokit(token);
    release = await octokit.rest.repos.getLatestRelease({
      owner: RELEASE_OWNER,
      repo: RELEASE_REPO,
    });
  } catch (error) {
    throw latestReleaseError(error);
  }

  return validateVersion(release.data.tag_name);
}

async function releaseAssetUrls(
  assets: ReleaseAssets,
  releaseToken: string,
): Promise<{ archiveUrl: string; checksumsUrl: string }> {
  const octokit = github.getOctokit(releaseToken);

  let release;
  try {
    release = await octokit.rest.repos.getReleaseByTag({
      owner: RELEASE_OWNER,
      repo: RELEASE_REPO,
      tag: assets.tag,
    });
  } catch (error) {
    throw releaseLookupError(assets.tag, error);
  }

  const urls = new Map(
    release.data.assets.map((asset) => [asset.name, asset.url]),
  );

  const find = (name: string): string => {
    const url = urls.get(name);
    if (!url) {
      throw new Error(
        `pr-triage: release '${assets.tag}' of ${RELEASE_OWNER}/${RELEASE_REPO} has no asset named '${name}'`,
      );
    }
    return url;
  };

  return {
    archiveUrl: find(assets.archiveName),
    checksumsUrl: find(assets.checksumsName),
  };
}

// An empty release token reads the public release URL, which also works for a
// token-authenticated runner. A non-empty token resolves the asset URLs through
// the release API, which is the only way to read a private release.
export async function downloadRelease(
  assets: ReleaseAssets,
  releaseToken: string,
): Promise<DownloadedRelease> {
  if (releaseToken === "") {
    const archivePath = await tc.downloadTool(assets.archiveUrl);
    const checksumsPath = await tc.downloadTool(assets.checksumsUrl);
    return { archivePath, checksumsPath };
  }

  const urls = await releaseAssetUrls(assets, releaseToken);
  const auth = `Bearer ${releaseToken}`;
  const headers = { accept: ASSET_ACCEPT };

  const archivePath = await tc.downloadTool(
    urls.archiveUrl,
    undefined,
    auth,
    headers,
  );
  const checksumsPath = await tc.downloadTool(
    urls.checksumsUrl,
    undefined,
    auth,
    headers,
  );

  return { archivePath, checksumsPath };
}

function runnerTemp(): string {
  const tmp = process.env.RUNNER_TEMP;
  if (!tmp) {
    throw new Error("pr-triage: RUNNER_TEMP is not set");
  }
  return tmp;
}

export async function installBinary(options: InstallOptions): Promise<string> {
  // The release token can read a private repository; the workflow token can
  // read the public one once pr-triage ships publicly.
  const version =
    options.version ||
    (await latestReleaseTag(options.releaseToken || options.githubToken));
  const assets = resolveAssets(
    version,
    process.env.RUNNER_OS ?? "",
    process.env.RUNNER_ARCH ?? "",
  );

  core.info(
    `Installing pr-triage ${assets.tag} for linux/${assets.arch} from ${RELEASE_OWNER}/${RELEASE_REPO}`,
  );

  const { archivePath, checksumsPath } = await downloadRelease(
    assets,
    options.releaseToken,
  );

  const checksums = fs.readFileSync(checksumsPath, "utf8");
  verifySha256(archivePath, parseChecksum(checksums, assets.archiveName));

  const binDir = fs.mkdtempSync(path.join(runnerTemp(), "pr-triage-bin-"));
  await tc.extractTar(archivePath, binDir);

  const binPath = path.join(binDir, BIN_NAME);
  if (!fs.existsSync(binPath)) {
    throw new Error(
      `pr-triage: '${assets.archiveName}' did not contain a '${BIN_NAME}' binary`,
    );
  }

  fs.chmodSync(binPath, 0o755);
  return binPath;
}
