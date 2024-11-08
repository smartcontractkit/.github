import * as fs from "fs";

import * as core from "@actions/core";
import { ExecaError } from "execa";

import {
  logSection,
  logObject,
  uploadBuildLogs,
  uploadRunLogs,
} from "./log.js";
import * as pipeline from "./pipeline/index.js";

export type Inputs = Readonly<ReturnType<typeof setup>>;

/**
 * Parse and validate inputs.
 * @returns {Inputs}
 */
function setup() {
  logSection("Setup");
  const moduleDirectory = core.getInput("module-directory") || ".";
  const updateIndex = core.getInput("update-index") || "false";
  const forceUpdateIndex = core.getInput("force-update-index") || "false";
  const runAllTests = core.getInput("run-all-tests") || "false";
  const tagFilter = core.getInput("tag-filter");
  const buildFlags = core.getInput("build-flags").split(" ");
  const hashesBranch = core.getInput("hashes-branch");
  const testSuite = core.getInput("test-suite") || "placeholder-test-suite";
  const buildDirectory = process.env.RUNNER_TEMP || `/tmp/cl/${testSuite}`;

  if (!fs.existsSync(buildDirectory)) {
    fs.mkdirSync(buildDirectory, { recursive: true });
  }

  if (tagFilter) {
    core.debug(
      `Found gobuild tag filter, adding -tags ${tagFilter} to build flags`,
    );
    buildFlags.push(`-tags=${tagFilter}`);
  }

  return {
    moduleDirectory,
    buildDirectory,
    tagFilter,
    buildFlags,
    updateIndex: updateIndex === "true",
    forceUpdateIndex: forceUpdateIndex === "true",
    hashesBranch,
    hashesFile: `${testSuite}.json`,
    testSuite,
    runAllTests: runAllTests === "true",
  };
}
export async function run() {
  const inputs = setup();

  try {
    const pkgs = await pipeline.getTestPackages(inputs);
    logObject("Packages", pkgs);

    const compiledPkgs = await pipeline.buildTestBinaries(inputs, pkgs);
    logObject("Compiled Test Packages", compiledPkgs);

    const hashedPkgs = await pipeline.generateHashes(compiledPkgs);
    logObject("Hashed Test Packages", hashedPkgs);

    const changedPkgs = await pipeline.filterChangedHashes(inputs, hashedPkgs);
    logObject("Changed Test Packages", changedPkgs);

    const execdPkgs = await pipeline.runTestBinaries(inputs, changedPkgs);
    logObject("Executed Test Packages", execdPkgs);

    // pass hashPkgs here instead of execdPkgs, as the latter is a subset of the former
    await pipeline.maybeUpdateHashIndex(inputs, hashedPkgs);
  } catch (error) {
    if (error instanceof ExecaError) {
      core.setFailed(
        `Error: ${error.command}, ${error.shortMessage}. exit code: ${error.exitCode}. cause: ${error.cause}. ${error.stack}`,
      );
    } else if (error instanceof Error) {
      core.setFailed(`Error: ${error.name}, ${error.message}. ${error.stack}`);
    }
  } finally {
    logSection("Upload Logs");
    const artifactKey = `${inputs.testSuite}`;
    await uploadBuildLogs(inputs.buildDirectory, artifactKey);
    await uploadRunLogs(inputs.buildDirectory, artifactKey);
    logSection("Done");
  }
}
