import * as core from "@actions/core";
import * as github from "@actions/github";

import semver, { SemVer } from "semver";

import { getInvokeContext, getInputs } from "./run-inputs";
import { listTags } from "./github";

type NewVersionInfo = {
  tag: string;
  version: string;
};

type Outputs = {
  latestTag: string;
  latestTagRaw: string;
  latestVersion: string;
  newVersions: {
    major: NewVersionInfo;
    minor: NewVersionInfo;
    patch: NewVersionInfo;
  };
};

function setOutputs(mostRecentTag?: ParsedMatchingTag) {
  const outputObj: Outputs = {
    latestTag: "",
    latestTagRaw: "",
    latestVersion: "",
    newVersions: {
      major: { tag: "", version: "" },
      minor: { tag: "", version: "" },
      patch: { tag: "", version: "" },
    },
  };

  if (!mostRecentTag) {
    core.warning(
      `No suitable tags found. Setting all outputs to empty strings.`,
    );
  } else {
    outputObj.latestTag = mostRecentTag.strippedRef;
    outputObj.latestTagRaw = mostRecentTag.rawRef;
    outputObj.latestVersion = mostRecentTag.semver.version;
    outputObj.newVersions = generateNewVersionInfo(mostRecentTag);
  }

  core.info(`Setting outputs: ${JSON.stringify(outputObj, null, 2)}`);
  core.setOutput("latest-tag", outputObj.latestTag);
  core.setOutput("latest-tag-raw", outputObj.latestTagRaw);
  core.setOutput("latest-version", outputObj.latestVersion);
  core.setOutput("new-versions-json", JSON.stringify(outputObj.newVersions));
}

export async function run() {
  try {
    // 1. Get inputs and context
    core.startGroup("Inputs and Context");
    const context = getInvokeContext();
    core.info(
      `Extracted Context: ${JSON.stringify({ ...context, token: "<redacted>" }, null, 2)}`,
    );

    const inputs = getInputs();
    core.info(`Extracted Inputs: ${JSON.stringify(inputs, null, 2)}`);

    const octokit = github.getOctokit(context.token);
    core.endGroup();

    // 2. Get all tags
    core.startGroup("Getting all tags/versions");
    const tags = await listTags(
      octokit,
      context.owner,
      context.repo,
      inputs.tagPrefix,
    );

    const parsedTags = parseMatchingRefs(tags, inputs.tagPrefix);

    parsedTags.forEach((parsedTag) => {
      core.info(
        `Parsed tag ${parsedTag.rawRef}: stripped to ${parsedTag.strippedRef}, version ${parsedTag.semver.version}`,
      );
    });
    core.endGroup();

    const mostRecentTag = parsedTags.reduce(
      (currentBest, candidate) => {
        if (!currentBest || candidate.semver.compare(currentBest.semver) > 0) {
          return candidate;
        }
        return currentBest;
      },
      null as ParsedMatchingTag | null,
    );

    setOutputs(mostRecentTag ?? undefined);
  } catch (error) {
    core.endGroup();
    core.setFailed(`Action failed: ${error}`);
  }
}

export type ParsedMatchingTag = {
  rawRef: string;
  strippedRef: string;
  strippedTag: string;
  semver: SemVer;
};

export function parseMatchingRefs(
  matchingRefs: { ref: string }[],
  prefix: string,
): ParsedMatchingTag[] {
  return matchingRefs
    .map((matchingRef) => parseMatchingRef(matchingRef, prefix))
    .filter((parsed): parsed is NonNullable<typeof parsed> => parsed !== null);
}

// exported for testing
export function parseMatchingRef(
  matchingRef: { ref: string },
  prefix: string,
): ParsedMatchingTag | null {
  const rawRef = matchingRef.ref;

  const containsExpectedPrefix = rawRef.startsWith(`refs/tags/${prefix}`);
  if (!containsExpectedPrefix) {
    core.warning(
      `Skipping ref ${rawRef} as it does not start with expected prefix refs/tags/${prefix}`,
    );
    return null;
  }

  const strippedRef = rawRef.replace("refs/tags/", "");
  const strippedTag = strippedRef.replace(`${prefix}`, "");
  const version = semver.parse(strippedTag);

  if (!version) {
    core.warning(
      `Skipping ref ${rawRef} as it does not contain a valid semver version after the prefix.`,
    );
    return null;
  }

  core.info(
    `Parsed tag ${rawRef}: stripped to ${strippedTag}, version ${version.version}`,
  );

  return { rawRef, strippedRef, strippedTag, semver: version };
}

export function generateNewVersionInfo(
  mostRecentTag: ParsedMatchingTag,
): Outputs["newVersions"] {
  const version = mostRecentTag.semver.version;

  // have to create new instances as the .inc method is mutating
  const majorInc = new SemVer(version).inc("major").version;
  const minorInc = new SemVer(version).inc("minor").version;
  const patchInc = new SemVer(version).inc("patch").version;

  return {
    major: {
      tag: `${mostRecentTag.strippedRef.replace(
        mostRecentTag.strippedTag,
        majorInc,
      )}`,
      version: majorInc,
    },
    minor: {
      tag: `${mostRecentTag.strippedRef.replace(
        mostRecentTag.strippedTag,
        minorInc,
      )}`,
      version: minorInc,
    },
    patch: {
      tag: `${mostRecentTag.strippedRef.replace(
        mostRecentTag.strippedTag,
        patchInc,
      )}`,
      version: patchInc,
    },
  };
}
