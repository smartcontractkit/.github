import * as fs from "fs";
import * as path from "path";

import * as core from "@actions/core";
import { ExecaError } from "execa";

import {
  logSection,
  logObject,
  uploadBuildLogs,
  uploadRunLogs,
  uploadStateFile,
} from "./log.js";
import * as pipeline from "./pipeline/index.js";

export type Inputs = Readonly<ReturnType<typeof setup>>;

/**
 * Parse and validate inputs.
 * @returns {Inputs}
 */
function setup() {
  const pipelineStep = core.getInput("pipeline-step");
  const moduleDirectory = core.getInput("module-directory") || ".";
  const forceUpdateIndex = core.getInput("force-update-index") || "false";
  const runAllTests = core.getInput("run-all-tests") || "false";
  const buildFlagsString = core.getInput("build-flags");
  const hashesBranch = core.getInput("hashes-branch");
  const testSuite = core.getInput("test-suite") || "placeholder-test-suite";
  const buildDirectory = process.env.RUNNER_TEMP || `/tmp/cl/${testSuite}`;
  const stepsDirectory = path.join(buildDirectory, "steps");
  const collectCoverage = core.getInput("collect-coverage") || "false";

  if (
    pipelineStep !== "build" &&
    pipelineStep !== "run" &&
    pipelineStep !== "update" &&
    pipelineStep !== "e2e"
  ) {
    core.setFailed(
      "Invalid pipeline step. Must be 'build','run', or 'update'.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(stepsDirectory)) {
    fs.mkdirSync(stepsDirectory, { recursive: true });
  }

  let buildFlags: string[] = [];
  if (buildFlagsString) {
    buildFlags = buildFlagsString.split(" ");
  }

  return {
    pipelineStep,
    moduleDirectory,
    buildDirectory,
    stepsDirectory,
    buildFlags,
    forceUpdateIndex: forceUpdateIndex === "true",
    hashesBranch,
    hashesFile: `${testSuite}.json`,
    testSuite,
    runAllTests: runAllTests === "true",
    collectCoverage: collectCoverage === "true",
  };
}
export async function run() {
  const inputs = setup();

  try {
    if (inputs.pipelineStep === "build") {
      const hashedPkgs = await buildStep(inputs);
      persistProcessState(inputs, hashedPkgs);
    } else if (inputs.pipelineStep === "run") {
      const hashedPkgs = loadBuildState(inputs);
      const execdPkgs = await runStep(inputs, hashedPkgs);
      persistProcessState(inputs, execdPkgs);
    } else if (inputs.pipelineStep === "update") {
      const execdPkgs = loadRunState(inputs);
      await pipeline.maybeUpdateHashIndex(inputs, execdPkgs);
    } else if (inputs.pipelineStep === "e2e") {
      const hashedPkgs = await buildStep(inputs);
      const execdPkgs = await runStep(inputs, hashedPkgs);
      await pipeline.maybeUpdateHashIndex(inputs, execdPkgs);
    }
  } catch (error) {
    if (error instanceof ExecaError) {
      core.setFailed(
        `${error.command}, ${error.shortMessage}. exit code: ${error.exitCode}. cause: ${error.cause}. ${error.stack}`,
      );
    } else if (error instanceof Error) {
      core.setFailed(`${error.name}, ${error.message}. ${error.stack}`);
    }
  } finally {
    logSection("Upload Logs");
    const artifactKey = `${inputs.testSuite}`;
    if (inputs.pipelineStep === "build") {
      await uploadBuildLogs(inputs.buildDirectory, artifactKey);
    } else if (inputs.pipelineStep === "run") {
      await uploadRunLogs(inputs.buildDirectory, artifactKey);
    }
  }
}

async function buildStep(inputs: Inputs) {
  const pkgs = await pipeline.getTestPackages(inputs);
  logObject("Packages", pkgs);
  const compiledPkgs = await pipeline.buildTestBinaries(inputs, pkgs);
  logObject("Compiled Test Packages", compiledPkgs);

  const hashedPkgs = await pipeline.generateHashes(compiledPkgs);
  logObject("Hashed Test Packages", hashedPkgs);

  return hashedPkgs;
}

async function runStep(
  inputs: Inputs,
  pkgs: Awaited<ReturnType<typeof buildStep>>,
) {
  const packages = await pipeline.processChangedPackages(inputs, pkgs);

  const changedPkgs = Object.fromEntries(
    Object.entries(packages).filter(([_, pkg]) => pkg.shouldRun),
  );
  logObject("Changed Test Packages", changedPkgs);

  const maybeExecdPkgs = await pipeline.runTestBinaries(inputs, packages);
  const execdPkgs = Object.fromEntries(
    Object.entries(maybeExecdPkgs).filter(([_, pkg]) => !!pkg.run),
  );
  logObject("Executed Test Packages", execdPkgs);

  return maybeExecdPkgs;
}

type BuildState = Awaited<ReturnType<typeof pipeline.generateHashes>>;

type RunState = Awaited<ReturnType<typeof pipeline.runTestBinaries>>;

async function persistProcessState(
  inputs: Inputs,
  state: BuildState | RunState,
) {
  const stateFile = path.join(
    inputs.stepsDirectory,
    `${inputs.pipelineStep}.json`,
  );
  core.debug(`Writing state to ${stateFile}`);
  fs.writeFileSync(stateFile, JSON.stringify(state));

  if (core.isDebug()) {
    await uploadStateFile(stateFile);
  }
}

function loadBuildState(inputs: Inputs): BuildState {
  const buildState = path.join(inputs.stepsDirectory, `build.json`);
  if (fs.existsSync(buildState)) {
    core.debug(`Loading state from ${buildState}`);
    return JSON.parse(fs.readFileSync(buildState, "utf8"));
  }
  throw new Error(`No state file found. ${buildState}`);
}

function loadRunState(inputs: Inputs): RunState {
  const stateFile = path.join(inputs.stepsDirectory, `run.json`);
  if (fs.existsSync(stateFile)) {
    core.debug(`Loading state from ${stateFile}`);
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  }
  throw new Error(`No state file found. ${stateFile}`);
}
